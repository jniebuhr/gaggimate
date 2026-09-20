#pragma once
#include <cstring>
#include <deque>
#include <memory>
#include <vector>
struct TestQueue {
    size_t capacity;
    size_t itemSize;
    std::deque<std::vector<unsigned char>> items;
};
using QueueHandle_t = std::shared_ptr<TestQueue>;
inline QueueHandle_t xQueueCreate(size_t capacity, size_t size) {
    return std::make_shared<TestQueue>(TestQueue{capacity, size, {}});
}
inline void vQueueDelete(QueueHandle_t &queue) { queue.reset(); }
inline void xQueueReset(const QueueHandle_t &queue) { queue->items.clear(); }
inline size_t uxQueueSpacesAvailable(const QueueHandle_t &queue) { return queue->capacity - queue->items.size(); }
inline int xQueueSend(const QueueHandle_t &queue, const void *item, uint32_t) { // NOSONAR: FreeRTOS copies untyped items.
    if (!uxQueueSpacesAvailable(queue))
        return 0;
    auto *bytes = static_cast<const unsigned char *>(item);
    queue->items.emplace_back(bytes, bytes + queue->itemSize);
    return 1;
}
inline int xQueueReceive(const QueueHandle_t &queue, void *item, uint32_t) { // NOSONAR: FreeRTOS copies untyped items.
    if (queue->items.empty())
        return 0;
    memcpy(item, queue->items.front().data(), queue->itemSize);
    queue->items.pop_front();
    return 1;
}
