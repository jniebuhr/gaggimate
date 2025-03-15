/* Copyright 2022 Vincent Stragier */
#include "freertos_utils.hpp"

BaseType_t xTaskCreatePinnedToCoreAndAssert(TaskFunction_t pvTaskCode, const char *pcName, uint32_t usStackDepth,
                                            void *pvParameters, UBaseType_t uxPriority, TaskHandle_t *pvCreatedTask,
                                            BaseType_t xCoreID) {

    BaseType_t xReturn =
        xTaskCreatePinnedToCore(pvTaskCode, pcName, usStackDepth, pvParameters, uxPriority, pvCreatedTask, xCoreID);

    configASSERT(pvCreatedTask);

    return xReturn;
}
