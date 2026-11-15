#ifndef NANOPBCOMM_LINK_SELECTOR_H
#define NANOPBCOMM_LINK_SELECTOR_H

#include "GaggiMateComm.h"
#include "Transport.h"
#include <atomic>

// Transport facade over several candidate links: one carries the session, the preferred link takes over whenever it is up.
class LinkSelector : public Transport {
  public:
    // Active link changed; LinkType::None means the session is gone and every link should search again.
    using SelectCallback = std::function<void(LinkType active)>;
    // A link connected while another one already carries the session; the owner has to drop it.
    using RejectCallback = std::function<void(LinkType rejected)>;

    // Hook a candidate link; call before the link starts connecting.
    void add(LinkType type, Transport &transport);
    // This link replaces any other one as soon as it connects, even mid-session.
    void setPreferred(LinkType type) { _preferred = type; }

    void onSelect(SelectCallback cb) { _selectCb = std::move(cb); }
    void onReject(RejectCallback cb) { _rejectCb = std::move(cb); }

    LinkType activeType() const { return _active.load(); }

    bool send(const uint8_t *data, size_t length) override;
    bool isConnected() const override;
    size_t maxDatagram() const override;

  private:
    static constexpr size_t MAX_LINKS = 2;
    struct Link {
        LinkType type = LinkType::None;
        Transport *transport = nullptr;
    };

    Link _links[MAX_LINKS]{};
    size_t _count = 0;
    std::atomic<LinkType> _active{LinkType::None};
    LinkType _preferred = LinkType::None;
    SelectCallback _selectCb = nullptr;
    RejectCallback _rejectCb = nullptr;

    Transport *transportFor(LinkType type) const;
    void handleConnection(LinkType type, bool connected);
};

#endif // NANOPBCOMM_LINK_SELECTOR_H
