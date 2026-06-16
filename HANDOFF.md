# HANDOFF — GaggiMate T-RGB 显示屏固件改造（自用 fork 维护交接）

> 给**接手维护的新对话/工程师**。本文件力求自包含,读完即可上手。
> 配套参考:仓库根 `README.md` 末尾「本地改动 & 实施计划」节。
> 语言约定:中文沟通,技术术语保留英文。

---

## 0. 一句话概括
给 GaggiMate(开源 Gaggia 咖啡机控制器项目)的 **LilyGo T-RGB 显示屏**做了几个 **display-only** 改造(无 WiFi 自动休眠/触摸唤醒、电池显示、开机动画、恢复冲煮 profile),并修复了一连串问题(黑屏、主控版本不匹配、网页 UI 白屏、配 WiFi)。**原则:只改显示屏侧;controller 用同仓库的官方代码刷,只为对齐通信协议版本。**

## 1. 仓库 & 环境
- Fork:`dmq1219/gaggimate`,分支 `feature/display-auto-sleep-battery`,基于 upstream `jniebuhr/gaggimate` 的 master。上游 PR:https://github.com/jniebuhr/gaggimate/pull/773
- 工作目录:`~/Desktop/gaggiamate 自动关机` **(目录名带空格!部分脚本/sim 对空格敏感)**

## 2. 硬件（刷写前务必按 MAC 区分两块板！）
| 板 | 型号 | MAC | Flash/PSRAM | 备注 |
|---|---|---|---|---|
| **Display** | LilyGo T-RGB(ESP32-S3,480×480 圆屏,CST820 触摸) | `68:ee:8f:46:a7:80` | 16MB / 8MB | 我们改的就是这块 |
| **Controller** | GaggiMate Pro Rev 1.1(ESP32-S3) | `a8:46:74:92:60:24` | 8MB / 2MB | proto 3,带压力+调光;跑官方代码 |

- 机器:Gaggia Classic Pro。
- **两块板都枚举成 `/dev/cu.usbmodem*`(2301/2401 编号不固定)**。刷任何东西前先 `esptool flash_id` 读 MAC 认准目标板 —— **曾误把 controller 固件刷到 display 板 → 黑屏**(可重刷 display 固件救回)。

## 3. 构建 / 刷写（关键坑，务必看）
- **必须用 Python 3.11 的 pio**:`/opt/homebrew/bin/python3.11 -m platformio run -e display`。系统默认 `pio` 跑在 3.9,前置脚本用了 `datetime.UTC` 会直接崩。
- **改了 `src/display/lv_conf.h`(字体/`LV_USE_GIF` 等)后**:PlatformIO 不会重编 LVGL → 必须 `rm -rf .pio/build/display/libb3a/lvgl` 再 build,否则链接报 `undefined reference` 或行为不更新。
- **改了网页包(`web/` 源码)后**:`scripts/embed_webui.py` 不被 SCons 当依赖追踪 → 见 §5「网页白屏」;纯 C++/lv_conf 改动不需要重跑 `build_webui.sh`。
- 刷写:`... -m platformio run -e display -t upload --upload-port <display口>`(先按 MAC 认准)。
- **显示屏没连 controller 时约 1–2 分钟自动深睡 → USB 串口消失**。刷/读串口前点屏唤醒(=重启,约 12 秒重连 WiFi);彻底刷不进时用下载模式(按住 BOOT/IO0 + 点 RST/EN + 松 BOOT)。
- 整片擦除(`-t erase`)后第一次 upload 常报 `No serial data received`(S3 重新枚举)→ 重试一次即可。

## 4. 已实现的功能（均 display-only，我们加的）
1. **无 controller 自动深睡 + 触摸唤醒** — `src/display/core/AutoSleepManager.h`(纯逻辑)+ `DefaultUI::tickAutoSleep()`(接线,~第 368 行)。蓝牙连不上 controller 超过 `noControllerSleepTimeout`(默认 120s)→ `panelDriver->sleep()`(ESP32 深睡,ext1/GPIO1 接 CST820 INT,唤醒=重启)。**计时只看蓝牙连接状态**,与触摸/动画/屏幕活动无关。**已去掉 AP 模式拦截**(没配 WiFi 也能睡),仅 OTA 升级/PID 自整定时不睡。设置:`autoSleepNoController`(开关)、`noControllerSleepTimeout`。蓝牙事件接线在 `DefaultUI.cpp` ~156–182。
2. **电池显示** — `src/display/core/BatteryMonitor.h`(读 GPIO4 分压 ADC,**无电量计 IC**;% 走分段 LUT;充电=电压≥4200mV 的启发式判断,无充电状态引脚)。叠加层 `DefaultUI::setupBatteryOverlay()`,`lv_layer_top()` 顶部居中,**字体 Montserrat 20**(曾放大到 42,后按要求缩小一半)。阈值在 `constants.h`。
3. **开机/待机动画** — `ui_StandbyScreen` 的 logo 对象改用 `lv_gif` 播「咖啡豆抛接」GIF(替换 GaggiMate logo,居中、~半屏)。`lv_conf` 开 `LV_USE_GIF`;素材内嵌 `src/display/ui/default/lvgl/images/ui_img_coffee_anim.c`(240×228 循环 GIF,`lv_img_dsc` cf=RAW);`ui.h` 有 `LV_IMG_DECLARE(ui_img_coffee_anim)`。源素材 6 帧 PNG 在 `~/Documents/家庭管理/coffee_bean_animation_large/`(抠浅灰底→合成到深背景 `0x131313`→GIF)。
4. **恢复 5 个冲煮 profile** — `data/p/*.json`(9bar / Adaptive v2 / Cremina lever / Damian's LM Leva / Backflush)。**无秤版**:出液停止条件由「克数 volumetric」改成「泵水量 pumped ml」(用户没有蓝牙秤)。原始未改版备份在 `data_p_orig_backup/`。这些经 `uploadfs` 写入 display 的 LittleFS `/p/`,固件 migrate 自动收藏后显示。

## 5. 关键修复（本次会话）
- **网页 UI / 配网页白屏(真根因)**:固件里嵌的网页包 `gWebUiBlobStart` 曾只有 **1 字节空壳** —— PlatformIO **不追踪 `.incbin` 依赖**,`web_ui_blob.S.o` 在空占位阶段编过后没随真 `web_ui.bin` 重编。设备按清单偏移读 → 读到隔壁 flash 垃圾 → 浏览器 `ERR_CONTENT_DECODING_FAILED`。**网页包/服务器/传输本身都没问题**(早先「热点截断」判断是错的)。修复:删 `web_ui_blob.S.o` 重编 + **`scripts/embed_webui.py` 已加"包大小+sha256 指纹"注释**,包一变 `.S` 就变 → 强制重编,永久防回归。判定方法:`nm firmware.elf | grep gWebUiBlob` 看 End−Start≈437748。
- **主控连不上 / "Version mismatch, update controller"**:显示屏靠 service-UUID `e75bc5b6-ff6e-4337-9d31-0c128f2e6e68` 扫描连 controller,**不存地址/不配对**。mismatch = `PROTOCOL_VERSION`(`lib/NanoPbComm/src/Protocol.h`,本 master=3)两端不一致。修:从**同一仓库**编 controller 固件刷主控(`pio run -e controller -t upload`)→ proto 对齐。本 fork 没改 controller 代码(`git diff upstream/master -- src/controller lib/` 为空)。
- **WiFi**:配网页当时白屏,曾在 `Controller::connect()` 一次性 seed 家庭 WiFi 写入 NVS,**明文凭据已从源码删除**(NVS 已持久化)。设备现 `192.168.0.36` @ SSID "Deng wifi 24"。网页 UI 现可从家庭网络打开。NVS 被清空时,(已修好的)配网页可正常设 WiFi。

## 6. ⚠️ 设置接口的坑（很重要，别再踩）
`POST /api/settings` 里**复选框类字段用「出现=true，不出现=false」**(`request->hasArg`,见 `WebUIPlugin.cpp` handleSettings ~629–705)。**只发部分字段的 POST 会把没带上的复选框全部置成 false!** 受影响:`autoSleepNoController` / `delayAdjust` / `clock24hFormat` / `autowakeupEnabled` / `homekit` / `boilerFillActive` / `smartGrindActive` / `homeAssistant` / `momentaryButtons`。
→ **改设置请优先用网页 UI**(它提交时一次发齐全部字段);若用 API,**必须带齐所有"该开"的复选框**。

## 7. 当前状态 & 待办（OPEN ITEMS）
- ✅ 网页 UI 已修好,可从 `http://192.168.0.36` 打开(需连 "Deng wifi 24")。
- ✅ 锅炉空闲自动待机(原机自带 `standbyTimeout`)= **600s(10min)**(本来是 15min,按需求改的;停加热)。
- ✅ 用户已在网页重新打开 **`autoSleepNoController`**;`noControllerSleepTimeout` 设为 **60s**。
- ⚠️ **待恢复**(被 §6 接口坑误关、默认本应为 `true`):**`delayAdjust`** 和 **`clock24hFormat`**。用网页打开即可,或发一条带齐所有该开复选框的 POST。其余被一起置 false 的(homekit/boilerFill/smartGrind/homeAssistant/autowakeup/momentaryButtons)默认本就是 false,无需管。
- 🔋 **电池过夜掉电异常待复测**:实测过夜 1000mAh@3.7V 从 88% → 62%(~26%)。**极可能是因为那晚自动休眠被误关、屏整夜没深睡**(亮/半亮态 ~几十 mA)。真深睡应是 µA 级,过夜只掉几 %。**自动休眠已重新打开 → 请重新过夜复测**;若仍异常,再查:深睡是否真进入(关机器后串口/USB 是否在 60s 后掉)、CST820 唤醒电路、WiFi 是否保持唤醒。
- 💡 用户提过的可选需求:**"机器开着但闲置一会儿也让屏睡"(idle-sleep-while-connected)** —— 当前**未实现**(现规则是"没主控才睡")。如要做:在 `tickAutoSleep` 增加一个基于 `lastAction`/进入 standby 的空闲计时分支。

## 8. 备份 / 安全网
- `display_flash_backup.bin` —— display 整片 16MB flash 备份(刷 profile 前所读),可整盘还原。
- `data_p_orig_backup/` —— 5 个 profile 的**原始(未改无秤版)**JSON。

## 9. 关键文件索引
- 自动休眠/唤醒:`src/display/core/AutoSleepManager.h`、`src/display/ui/default/DefaultUI.cpp`、`src/display/drivers/LilyGoDriver.h`、`src/display/drivers/LilyGo-T-RGB/LilyGo_RGBPanel.cpp`(深睡/ext1 唤醒)
- 电池:`src/display/core/BatteryMonitor.h`、`src/display/core/constants.h`
- 开机动画:`src/display/ui/default/lvgl/screens/ui_StandbyScreen.c`、`.../images/ui_img_coffee_anim.c`、`.../lvgl/ui.h`、`src/display/lv_conf.h`
- 网页嵌入:`scripts/embed_webui.py`、`scripts/build_webui.sh`、`src/display/webassets/`
- 设置/HTTP 接口:`src/display/core/Settings.{h,cpp}`、`src/display/plugins/WebUIPlugin.cpp`(handleSettings)
- 主控连接/协议:`lib/NanoPbComm/src/ble/BleClientTransport.cpp`、`lib/NanoPbComm/src/Protocol.h`
- 完整改动叙述见仓库根 `README.md` 末「本地改动 & 实施计划」节。
