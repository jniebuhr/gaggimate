#pragma once
#include <unordered_map>
#include <list>
#include <string>

class LRUCache {
public:
  LRUCache(size_t capacity) : capacity(capacity) {}

  bool exists(std::string value) {
    auto it = cacheMap.find(value);
    if (it != cacheMap.end()) {
      // Value is already in cache, move it to the front
      usageList.erase(it->second);
      usageList.push_front(value);
      it->second = usageList.begin();
      return true;
    }
    if (usageList.size() >= capacity) {
      // Cache is full, remove the least recently used device
      auto last = usageList.back();
      cacheMap.erase(last);
      usageList.pop_back();
    }
    // Insert or update the device at the front of the list
    usageList.push_front(value);
    cacheMap[value] = usageList.begin();
    return false;
  }

  void cleanup() {
    cacheMap.clear();
    usageList.clear();
  }

private:
  size_t capacity;
  std::list<std::string> usageList; // Doubly-linked list of device IDs
  std::unordered_map<std::string, std::list<std::string>::iterator> cacheMap; // Maps device IDs to positions in the list
};
