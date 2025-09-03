#include "HardwareScalePlugin.h"
#include <display/core/Controller.h>

HardwareScalePlugin HardwareScales;

HardwareScalePlugin::HardwareScalePlugin() = default;

void HardwareScalePlugin::setup(Controller *controller, PluginManager *pluginManager) {
    this->controller = controller;

    // Send scale factors immediately on BLE connection to minimize startup delay
    pluginManager->on("controller:bluetooth:connect", [this](Event const &) {
        if (this->controller->getSystemInfo().capabilities.hwScale) {
            _scaleFactor1 = this->controller->getSettings().getScaleFactor1();
            _scaleFactor2 = this->controller->getSettings().getScaleFactor2();
            
            // Always send scale factors to unblock the hardware scale
            if (_scaleFactor1 == 0.0f || _scaleFactor2 == 0.0f) {
                ESP_LOGW(LOG_TAG, "Scale factors not configured (%.3f, %.3f), sending defaults until calibrated", _scaleFactor1, _scaleFactor2);
                float defaultFactor1 = (_scaleFactor1 == 0.0f) ? -2500.0f : _scaleFactor1;
                float defaultFactor2 = (_scaleFactor2 == 0.0f) ? 2500.0f : _scaleFactor2;
                this->controller->getClientController()->sendScaleCalibration(defaultFactor1, defaultFactor2);
            } else {
                ESP_LOGI(LOG_TAG, "Sending configured scale factors: %.3f, %.3f", _scaleFactor1, _scaleFactor2);
                this->controller->getClientController()->sendScaleCalibration(_scaleFactor1, _scaleFactor2);
            }
        }
    });

    pluginManager->on("controller:ready", [this](Event const &) {
        _isAvailable = this->controller->getSystemInfo().capabilities.hwScale;
        
        ESP_LOGI(LOG_TAG, "Hardware scale available: %s", _isAvailable ? "true" : "false");

        if (_isAvailable) {
            // Scale factors should already be sent, but send tare command
            delay(50); // Small delay to ensure scale factors are processed
            this->controller->getClientController()->sendScaleTare();
        }

        this->controller->setVolumetricOverride(_isAvailable);
    });

    pluginManager->on("controller:brew:prestart", [this](Event const &) {
       onProcessStart();
    });

    pluginManager->on("controller:scale:measurement", [this](Event const &event) {
        float value = event.getFloat("value");
        this->onMeasurement(value);
    });

    pluginManager->on("controller:scale:cal_update", [this](Event const &event) {
        _scaleFactor1 = event.getFloat("scaleFactor1");
        _scaleFactor2 = event.getFloat("scaleFactor2");
        this->controller->getSettings().setScaleFactors(_scaleFactor1, _scaleFactor2);
        
        // Immediately send updated scale factors to hardware scale - no reboot required
        if (_isAvailable) {
            ESP_LOGI(LOG_TAG, "Scale factors updated, sending to hardware: %.3f, %.3f", _scaleFactor1, _scaleFactor2);
            this->controller->getClientController()->sendScaleCalibration(_scaleFactor1, _scaleFactor2);
        }
    });
}

void HardwareScalePlugin::tare() {
    if (_isAvailable) {
        controller->getClientController()->sendScaleTare();
    }
}

void HardwareScalePlugin::calibrate(uint8_t cell, float calibrationWeight) {
    if (_isAvailable) {
        controller->getClientController()->sendCalibrateScale(cell, calibrationWeight);
    }
}

void HardwareScalePlugin::onProcessStart() {
    if (_isAvailable) {
        // Hardware scale already tared by Controller::activate()
        // Just ensure we're ready to receive measurements
        ESP_LOGD(LOG_TAG, "Hardware scale ready for brewing process");
    }
}

void HardwareScalePlugin::onMeasurement(float value) {
    this->_lastMeasurement = value;
    controller->onVolumetricMeasurement(value, VolumetricMeasurementSource::HARDWARE);
}