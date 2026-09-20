#ifndef NANOPBCOMM_COALESCING_PRIORITY_QUEUE_H
#define NANOPBCOMM_COALESCING_PRIORITY_QUEUE_H

#include <array>
#include <cstddef>
#include <cstdint>
#include <optional>

/**
 * Fixed-capacity max-heap that coalesces by key.
 *
 * `upsert(key, prio, payload)` replaces the existing entry for a key (bumping
 * its sequence so it still beats older entries) instead of inserting a
 * duplicate -- so a burst of updates for the same component collapses to the
 * latest value. Ordering is by priority, then newest-first on ties.
 *
 * KeyT must map densely into [0, MaxKeys); keys outside that range are rejected.
 * All operations are O(log N); no dynamic allocation.
 */
template <size_t N, typename KeyT = uint16_t, typename PayloadT = uint32_t, size_t MaxKeys = 1024> class CoalescingPrioQueue {
  public:
    struct Msg {
        KeyT key;         // which message family/device
        uint8_t prio;     // 0..255 (higher = more urgent)
        uint32_t seq;     // monotonic, breaks ties (newer first)
        PayloadT payload; // user data
    };

    CoalescingPrioQueue() { clear(); }

    void clear() {
        size_ = 0;
        seqCounter_ = 1;
        for (auto &p : posOfKey_)
            p = kNoPos;
        for (auto &u : used_)
            u = false;
    }

    bool empty() const { return size_ == 0; }
    size_t size() const { return size_; }
    size_t capacity() const { return N; }

    // Insert or update the entry for this key. Returns false if the queue is
    // full and the key is not already present.
    bool upsert(KeyT key, uint8_t prio, const PayloadT &payload) {
        if (key >= MaxKeys)
            return false;

        if (posOfKey_[key] != kNoPos) {
            auto idx = posOfKey_[key];
            auto &m = entries_[heap_[idx]];
            m.prio = prio;
            m.seq = nextSeq_();
            m.payload = payload;
            fixUp_(idx);
            fixDown_(idx);
            return true;
        }
        if (size_ >= N)
            return false;
        size_t storeIndex = allocate_();
        entries_[storeIndex] = Msg{key, prio, nextSeq_(), payload};
        heap_[size_] = static_cast<uint16_t>(storeIndex);
        posOfKey_[key] = static_cast<uint16_t>(size_);
        fixUp_(static_cast<uint16_t>(size_));
        ++size_;
        return true;
    }

    bool invalidate(KeyT key) {
        if (key >= MaxKeys)
            return false;
        auto pos = posOfKey_[key];
        if (pos == kNoPos)
            return false;
        free_(heap_[pos]);
        removeAt_(pos);
        return true;
    }

    std::optional<Msg> top() const {
        if (empty())
            return std::nullopt;
        return entries_[heap_[0]];
    }

    std::optional<Msg> pop() {
        if (empty())
            return std::nullopt;
        auto outIdx = heap_[0];
        Msg out = entries_[outIdx];
        free_(outIdx);
        removeAt_(0);
        return out;
    }

  private:
    static constexpr uint16_t kNoPos = 0xFFFF;

    std::array<Msg, N> entries_{};
    std::array<uint16_t, N> heap_{};
    std::array<uint16_t, MaxKeys> posOfKey_{};
    std::array<bool, N> used_{};
    size_t size_ = 0;
    uint32_t seqCounter_ = 1;

    uint32_t nextSeq_() { return seqCounter_++; }

    bool higher_(uint16_t aIdx, uint16_t bIdx) const {
        const auto &a = entries_[aIdx];
        const auto &b = entries_[bIdx];
        if (a.prio != b.prio)
            return a.prio > b.prio;
        return a.seq > b.seq; // newer wins on tie
    }

    void swapPos_(uint16_t i, uint16_t j) {
        auto ai = heap_[i];
        auto aj = heap_[j];
        heap_[i] = aj;
        heap_[j] = ai;
        posOfKey_[entries_[aj].key] = i;
        posOfKey_[entries_[ai].key] = j;
    }

    void fixUp_(uint16_t i) {
        while (i > 0) {
            uint16_t p = (i - 1) >> 1;
            if (higher_(heap_[i], heap_[p])) {
                swapPos_(i, p);
                i = p;
            } else
                break;
        }
    }

    void fixDown_(uint16_t i) {
        for (;;) {
            uint16_t l = (i << 1) + 1;
            uint16_t r = l + 1;
            uint16_t best = i;
            if (l < size_ && higher_(heap_[l], heap_[best]))
                best = l;
            if (r < size_ && higher_(heap_[r], heap_[best]))
                best = r;
            if (best != i) {
                swapPos_(i, best);
                i = best;
            } else
                break;
        }
    }

    void removeAt_(uint16_t i) {
        uint16_t last = static_cast<uint16_t>(size_ - 1);
        uint16_t idx = heap_[i];
        posOfKey_[entries_[idx].key] = kNoPos;

        if (i != last) {
            heap_[i] = heap_[last];
            posOfKey_[entries_[heap_[i]].key] = i;
        }
        --size_;
        if (i < size_) {
            fixUp_(i);
            fixDown_(i);
        }
    }

    size_t allocate_() {
        for (size_t i = 0; i < N; ++i) {
            if (!used_[i]) {
                used_[i] = true;
                return i;
            }
        }
        return 0;
    }

    void free_(size_t idx) { used_[idx] = false; }
};

#endif // NANOPBCOMM_COALESCING_PRIORITY_QUEUE_H
