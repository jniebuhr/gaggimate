#ifndef COALESCINGPRIORITYQUEUE_H
#define COALESCINGPRIORITYQUEUE_H

#include <cstdint>
#include <array>
#include <optional>
#include <utility>

template<size_t N, typename KeyT = uint16_t, typename PayloadT = uint32_t>
class CoalescingPrioQueue {
public:
    struct Msg {
        KeyT      key;         // which message family
        uint8_t   prio;        // 0..255 (higher = more urgent)
        uint32_t  seq;         // monotonic, breaks ties (newer first)
        PayloadT  payload;     // user data
    };

    CoalescingPrioQueue() {
        clear();
    }

    void clear() {
        size_ = 0;
        seqCounter_ = 1;
        for (auto &p : posOfKey_) p = kNoPos;
        for (auto &u : used_) u = false;
    }

    bool empty() const { return size_ == 0; }
    size_t size() const { return size_; }
    size_t capacity() const { return N; }

    // Insert or update existing message for this key.
    // Returns false if full and key not present (no insert), true otherwise.
    bool upsert(KeyT key, uint8_t prio, const PayloadT& payload) {
        if (key >= kMaxKeys) return false; // guard if you map KeyT densely; otherwise replace with a hashmap.

        if (posOfKey_[key] != kNoPos) {
            // Update existing node; bump seq so it beats older.
            auto idx = posOfKey_[key];
            auto &m = entries_[heap_[idx]];
            m.prio = prio;
            m.seq  = nextSeq_();
            m.payload = payload;
            fixUp_(idx);
            fixDown_(idx);
            return true;
        } else {
            if (size_ >= N) return false; // queue full
            // Reuse a free slot or the next index
            size_t storeIndex = allocate_();
            entries_[storeIndex] = Msg{key, prio, nextSeq_(), payload};
            heap_[size_] = storeIndex;
            posOfKey_[key] = size_;
            fixUp_(size_);
            ++size_;
            return true;
        }
    }

    // Invalidate a key if present (remove from heap). O(log N).
    bool invalidate(KeyT key) {
        if (key >= kMaxKeys) return false;
        auto pos = posOfKey_[key];
        if (pos == kNoPos) return false;
        removeAt_(pos);
        return true;
    }

    // Peek highest priority (without popping)
    std::optional<Msg> top() const {
        if (empty()) return std::nullopt;
        return entries_[heap_[0]];
    }

    // Pop highest priority
    std::optional<Msg> pop() {
        if (empty()) return std::nullopt;
        auto outIdx = heap_[0];
        Msg out = entries_[outIdx];
        free_(outIdx);
        removeAt_(0);
        return out;
    }

private:
    // Tunables: if KeyT is dense, set kMaxKeys accordingly. For sparse keys, replace with a flat_map.
    static constexpr size_t kMaxKeys = 1024;   // adjust to your key space
    static constexpr uint16_t kNoPos = 0xFFFF;

    // Storage
    std::array<Msg, N> entries_{};
    // Heap of indices into entries_
    std::array<uint16_t, N> heap_{};
    // Reverse map: key -> heap position (kNoPos if absent)
    std::array<uint16_t, kMaxKeys> posOfKey_{};
    // Free list
    std::array<bool, N> used_{};
    size_t size_ = 0;
    uint32_t seqCounter_ = 1;

    uint32_t nextSeq_() {
        // Wrap is fine because comparison uses subtraction semantics below if desired.
        return seqCounter_++;
    }

    // Comparator: return true if a has *higher* priority than b
    bool higher_(uint16_t aIdx, uint16_t bIdx) const {
        const auto &a = entries_[aIdx];
        const auto &b = entries_[bIdx];
        if (a.prio != b.prio) return a.prio > b.prio;
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
            if (higher_(heap_[i], heap_[p])) { swapPos_(i, p); i = p; }
            else break;
        }
    }

    void fixDown_(uint16_t i) {
        for (;;) {
            uint16_t l = (i << 1) + 1;
            uint16_t r = l + 1;
            uint16_t best = i;
            if (l < size_ && higher_(heap_[l], heap_[best])) best = l;
            if (r < size_ && higher_(heap_[r], heap_[best])) best = r;
            if (best != i) { swapPos_(i, best); i = best; }
            else break;
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
            if (!used_[i]) { used_[i] = true; return i; }
        }
        return 0;
    }

    void free_(size_t idx) { used_[idx] = false; }
};


#endif //COALESCINGPRIORITYQUEUE_H
