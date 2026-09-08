#include "ADSAdc.h"
#include "Wire.h"

ADSAdc::ADSAdc(uint8_t sda_pin, uint8_t scl_pin, AdcRates rates)
    : _sda_pin(sda_pin), _scl_pin(scl_pin), _rates(rates), taskHandle(nullptr) {}

void ADSAdc::setup() {
    uint32_t total = 0;
    for (auto rate : _rates) total += rate;
    // 570 SPS is the conservative requested budget, including I2C servicing.
    if (total == 0 || total > 570) {
        ESP_LOGE(LOG_TAG, "Invalid ADS rate allocation: %lu SPS (1..570 required)", static_cast<unsigned long>(total));
        return;
    }
    Wire1.begin(_sda_pin, _scl_pin, ADC_I2C_CLOCK_HZ);
    ESP_LOGV(LOG_TAG, "Initializing ADS1115 on SDA: %d, SCL: %d", _sda_pin, _scl_pin);
    delay(100);
    ads = new ADS1115(0x48, &Wire1);
    if (!ads->begin()) {
        ESP_LOGE(LOG_TAG, "Failed to initialize ADS1115");
        return;
    }
    ads->setGain(0);
    ads->setDataRate(7); // ADS1115 maximum: 860 SPS (~1.16 ms/conversion)
    ads->setMode(1);
    const esp_timer_create_args_t args = {
        .callback = onTick, .arg = this, .dispatch_method = ESP_TIMER_TASK, .name = "ADSAdc"};
    if (esp_timer_create(&args, &_timer) != ESP_OK) {
        ESP_LOGE(LOG_TAG, "Could not create ADC timer");
        return;
    }
    _reportAt = esp_timer_get_time();
    for (uint8_t ch = 0; ch < 4; ++ch) {
        if (_rates[ch]) _schedule.configure(ch, 1000000 / _rates[ch], _reportAt + ch * 500);
    }
    if (xTaskCreate(loopTask, "ADSAdc::loop", configMINIMAL_STACK_SIZE * 4, this, 1, &taskHandle) != pdPASS) {
        ESP_LOGE(LOG_TAG, "Could not create ADC task");
        esp_timer_delete(_timer);
        _timer = nullptr;
        return;
    }
    xTaskNotifyGive(taskHandle);
}

void ADSAdc::loop() {
    int reading = 0;
    const uint8_t completedChannel = _currentChannel;
    bool delivered = false;
    if (_pending) {
        ads->getError();
        const bool ready = ads->isReady();
        if (ads->getError() != ADS1X15_OK) {
            ++_errors;
        } else if (!ready && esp_timer_get_time() - _conversionStarted < 10000) {
            esp_timer_start_once(_timer, 100);
            return;
        } else if (ready) {
            reading = ads->getValue();
            delivered = ads->getError() == ADS1X15_OK;
            if (!delivered) ++_errors;
        } else {
            ++_errors;
        }
        _pending = false;
    }

    // Absolute deadlines preserve average rates; overdue work never creates
    // an unbounded catch-up burst.
    _currentChannel = _schedule.next();
    const int64_t now = esp_timer_get_time();
    if (_schedule.deadline(_currentChannel) > now) {
        esp_timer_start_once(_timer, _schedule.deadline(_currentChannel) - now);
    } else {
        if (_schedule.advance(_currentChannel, now)) ++_late;
        ads->getError();
        ads->requestADC(_currentChannel);
        _pending = ads->getError() == ADS1X15_OK;
        if (!_pending) ++_errors;
        _conversionStarted = esp_timer_get_time();
        esp_timer_start_once(_timer, ADC_CONVERSION_WAIT_US);
    }
    // Start the next conversion before delivering the previous sample.
    if (delivered) {
        ++_counts[completedChannel];
        portENTER_CRITICAL(&_mux);
        _value[completedChannel] = reading;
        auto &window = _windows[completedChannel];
        if (window.count < UINT16_MAX) {
            window.sum += reading;
            ++window.count;
            window.minimum = std::min(window.minimum, reading);
            window.maximum = std::max(window.maximum, reading);
        }
        portEXIT_CRITICAL(&_mux);
        if (_callback) _callback(completedChannel, reading);
    }
    if (now - _reportAt >= 10000000) {
        const float seconds = (now - _reportAt) / 1000000.0f;
        ESP_LOGI(LOG_TAG, "SPS ch0=%.1f ch1=%.1f ch2=%.1f ch3=%.1f errors=%lu missed=%lu",
                 _counts[0]/seconds, _counts[1]/seconds, _counts[2]/seconds, _counts[3]/seconds,
                 static_cast<unsigned long>(_errors), static_cast<unsigned long>(_late));
        for (auto &count : _counts) count = 0;
        _errors = _late = 0;
        _reportAt = now;
    }
}

bool ADSAdc::consumeAverage(uint8_t channel, float &average, uint16_t &count, int &minimum, int &maximum) {
    if (channel > 3) return false;
    portENTER_CRITICAL(&_mux);
    const Window window = _windows[channel];
    _windows[channel] = Window{};
    portEXIT_CRITICAL(&_mux);
    count = window.count;
    if (!count) return false;
    average = static_cast<float>(window.sum) / count;
    minimum = window.minimum;
    maximum = window.maximum;
    return true;
}

void ADSAdc::onTick(void *arg) { xTaskNotifyGive(static_cast<ADSAdc *>(arg)->taskHandle); }

void ADSAdc::registerCallback(ads_callback_t callback) { _callback = callback; }

[[noreturn]] void ADSAdc::loopTask(void *arg) {
    auto *sensor = static_cast<ADSAdc *>(arg);
    while (true) {
        ulTaskNotifyTake(pdTRUE, portMAX_DELAY);
        sensor->loop();
    }
}
