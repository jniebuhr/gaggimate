#ifndef MUSESPRITES_H
#define MUSESPRITES_H

#ifndef GAGGIMATE_HEADLESS // the headless build has no LVGL at all

#include <lvgl.h>

#ifdef __cplusplus
extern "C" {
#endif

// Muse character poses, generated from the sprite sheet in
// workspace/gaggimate-muse-display/assets-src (see gen_assets.py there).
// Format: LV_IMG_CF_TRUE_COLOR_ALPHA (RGB565 + per-pixel alpha).
extern const lv_img_dsc_t muse_pose_sleep;
extern const lv_img_dsc_t muse_pose_heating;
extern const lv_img_dsc_t muse_pose_ready;
extern const lv_img_dsc_t muse_pose_brewing;
extern const lv_img_dsc_t muse_pose_steaming;
extern const lv_img_dsc_t muse_pose_celebrate;
extern const lv_img_dsc_t muse_pose_warning;
extern const lv_img_dsc_t muse_pose_done;

#ifdef __cplusplus
}
#endif

#endif // GAGGIMATE_HEADLESS

#endif // MUSESPRITES_H
