#include "LinkSelector.h"
#include <esp_log.h>

static constexpr const char *LOG_TAG = "LinkSelector";

static const char *linkName(LinkType type) {
    switch (type) {
    case LinkType::Ble:
        return "BLE";
    case LinkType::Uart:
        return "UART";
    default:
        return "none";
    }
}

void LinkSelector::add(LinkType type, Transport &transport) {
    if (_count >= MAX_LINKS || type == LinkType::None)
        return;
    _links[_count++] = {type, &transport};
    transport.onData([this, type](const uint8_t *data, size_t length) {
        if (_active.load() == type)
            emitData(data, length);
    });
    transport.onConnectionChange([this, type](bool connected) { handleConnection(type, connected); });
}

Transport *LinkSelector::transportFor(LinkType type) const {
    for (size_t i = 0; i < _count; i++) {
        if (_links[i].type == type)
            return _links[i].transport;
    }
    return nullptr;
}

void LinkSelector::handleConnection(LinkType type, bool connected) {
    if (connected) {
        LinkType expected = LinkType::None;
        if (_active.compare_exchange_strong(expected, type)) {
            ESP_LOGI(LOG_TAG, "Controller link established over %s", linkName(type));
            if (_selectCb)
                _selectCb(type);
            emitConnection(true);
        } else if (expected == type) {
            emitConnection(true); // BLE reports a link twice (connect + subscribe); keep that visible to the session
        } else if (type == _preferred && _active.compare_exchange_strong(expected, type)) {
            // The session restarts on the preferred link; the owner drops the old one from the select callback.
            ESP_LOGI(LOG_TAG, "%s is up, taking the session over from %s", linkName(type), linkName(expected));
            emitConnection(false);
            if (_selectCb)
                _selectCb(type);
            emitConnection(true);
        } else {
            ESP_LOGW(LOG_TAG, "%s connected while %s carries the session, dropping it", linkName(type), linkName(expected));
            if (_rejectCb)
                _rejectCb(type);
        }
        return;
    }
    LinkType expected = type;
    if (!_active.compare_exchange_strong(expected, LinkType::None))
        return; // a link that never carried the session went away
    ESP_LOGI(LOG_TAG, "%s link lost, searching on all links", linkName(type));
    emitConnection(false);
    if (_selectCb)
        _selectCb(LinkType::None);
}

bool LinkSelector::send(const uint8_t *data, size_t length) {
    Transport *transport = transportFor(_active.load());
    return transport != nullptr && transport->send(data, length);
}

bool LinkSelector::isConnected() const {
    const Transport *transport = transportFor(_active.load());
    return transport != nullptr && transport->isConnected();
}

size_t LinkSelector::maxDatagram() const {
    const Transport *transport = transportFor(_active.load());
    if (transport != nullptr)
        return transport->maxDatagram();
    size_t limit = SIZE_MAX;
    for (size_t i = 0; i < _count; i++)
        limit = std::min(limit, _links[i].transport->maxDatagram());
    return _count > 0 ? limit : 0;
}
