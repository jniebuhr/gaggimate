#pragma once
#include <cstring>
#include <deque>
#include <vector>
struct TestQueue {
    size_t capacity, itemSize;
    std::deque<std::vector<unsigned char>> items;
};
using QueueHandle_t = TestQueue *;
inline QueueHandle_t xQueueCreate(size_t capacity, size_t size) { return new TestQueue{capacity, size, {}}; }
inline void vQueueDelete(QueueHandle_t q) { delete q; }
inline void xQueueReset(QueueHandle_t q) { q->items.clear(); }
inline size_t uxQueueSpacesAvailable(QueueHandle_t q) { return q->capacity - q->items.size(); }
inline int xQueueSend(QueueHandle_t q, const void *p, uint32_t) {
    if (!uxQueueSpacesAvailable(q))
        return 0;
    auto *bytes = static_cast<const unsigned char *>(p);
    q->items.emplace_back(bytes, bytes + q->itemSize);
    return 1;
}
inline int xQueueReceive(QueueHandle_t q, void *p, uint32_t) {
    if (q->items.empty())
        return 0;
    memcpy(p, q->items.front().data(), q->itemSize);
    q->items.pop_front();
    return 1;
}
