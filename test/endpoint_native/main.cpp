// Tests the production endpoint with real nanopb encoding; tasks are driven explicitly.
#include "Endpoint.h"
#include <array>
#include <cassert>
#include <chrono>
#include <future>
#include <iostream>
#include <mutex>
#include <pb_decode.h>
#include <pb_encode.h>
#include <thread>
#include <vector>
unsigned long &testClock() {
    static unsigned long value = 0;
    return value;
}
struct Link : Transport {
    std::vector<gm::Frame> frames;
    std::function<void(const gm::Frame &)> duringSend;
    uint32_t connectionSession() const override {
        std::lock_guard<std::mutex> guard(stateMutex);
        sessionRead = true;
        return session;
    }
    bool isConnected() const override {
        std::lock_guard<std::mutex> guard(stateMutex);
        if (reconnectAfterSnapshot && sessionRead) {
            ++session;
            reconnectAfterSnapshot = false;
        }
        return connected;
    }
    bool sendForSession(const uint8_t *bytes, size_t length, uint32_t expectedSession) override {
        {
            std::lock_guard<std::mutex> guard(stateMutex);
            if (expectedSession != session)
                return false;
        }
        return send(bytes, length);
    }
    bool send(const uint8_t *bytes, size_t length) override {
        gm::Frame f = gaggimate_Frame_init_zero;
        auto stream = pb_istream_from_buffer(bytes, length);
        assert(pb_decode(&stream, &gaggimate_Frame_msg, &f));
        frames.push_back(f);
        if (duringSend)
            duringSend(f);
        return true;
    }
    void receive(const gm::Frame &f) {
        std::array<uint8_t, 256> bytes{};
        auto stream = pb_ostream_from_buffer(bytes.data(), bytes.size());
        assert(pb_encode(&stream, &gaggimate_Frame_msg, &f));
        emitData(bytes.data(), stream.bytes_written);
    }
    void ack(uint32_t id) {
        gm::Frame f = gaggimate_Frame_init_zero;
        f.ack = id;
        receive(f);
    }
    void reset() {
        emitConnection(false);
        emitConnection(true);
    }
    void reconnectAfterNextSnapshot() {
        std::lock_guard<std::mutex> guard(stateMutex);
        reconnectAfterSnapshot = true;
    }

  private:
    mutable std::mutex stateMutex;
    bool connected = true;
    mutable uint32_t session = 1;
    mutable bool reconnectAfterSnapshot = false;
    mutable bool sessionRead = false;
};
gm::Payload pump(float power) {
    gm::Payload p = gaggimate_Payload_init_zero;
    p.which_content = gaggimate_Payload_pump_tag;
    p.content.pump.power = power;
    return p;
}
void enqueue_and_callback_never_send() {
    Link link;
    Endpoint ep(link);
    ep.begin();
    ep.send(pump(80));
    assert(link.frames.empty());
    ep.loop();
    assert(link.frames.size() == 1);
    gm::Frame inbound = gaggimate_Frame_init_zero;
    inbound.id = 10;
    link.receive(inbound);
    assert(link.frames.size() == 1);
    ep.loop();
    assert(link.frames.back().ack == 10 && link.frames.back().id == 0);
}
void stop_supersedes_unacknowledged_start() {
    Link link;
    Endpoint ep(link);
    ep.begin();
    int failures = 0;
    ep.onSendFailed([&failures] { ++failures; });
    ep.send(pump(80));
    ep.loop();
    auto oldId = link.frames.back().id;
    ep.send(pump(90));
    auto stop = pump(0);
    ep.sendStop(&stop, 1);
    ep.loop();
    auto stopId = link.frames.back().id;
    assert(stopId > oldId && link.frames.back().payloads[0].content.pump.power == 0);
    link.ack(oldId);
    testClock() += 151;
    ep.loop();
    assert(link.frames.back().id == stopId && link.frames.back().payloads[0].content.pump.power == 0);
    link.ack(stopId);
    auto count = link.frames.size();
    ep.loop();
    assert(link.frames.size() == count);
    assert(failures == 0);
}
void ack_during_send_is_not_lost() {
    Link link;
    Endpoint ep(link);
    ep.begin();
    link.duringSend = [&link](const gm::Frame &f) { link.ack(f.id); };
    ep.send(pump(50));
    ep.loop();
    ep.send(pump(60));
    ep.loop();
    assert(link.frames.size() == 2 && link.frames.back().id > link.frames.front().id);
    assert(link.frames.back().payloads[0].content.pump.power == 60);
}
void frame_is_not_sent_after_connection_session_changes() {
    Link link;
    Endpoint ep(link);
    ep.begin();
    ep.send(pump(50));
    link.reconnectAfterNextSnapshot();
    ep.loop();
    assert(link.frames.empty());
}
void blocked_io_does_not_block_stop_enqueue() {
    Link link;
    Endpoint ep(link);
    ep.begin();
    std::promise<void> entered;
    std::promise<void> release;
    auto resume = release.get_future();
    link.duringSend = [&entered, &resume](const gm::Frame &) {
        entered.set_value();
        resume.wait();
    };
    ep.send(pump(100));
    std::thread sender([&ep] { ep.loop(); });
    entered.get_future().wait();
    std::promise<void> enqueued;
    auto enqueuedFuture = enqueued.get_future();
    std::thread enqueue([&ep, &enqueued] {
        auto stop = pump(0);
        ep.sendStop(&stop, 1);
        enqueued.set_value();
    });
    bool prompt = enqueuedFuture.wait_for(std::chrono::milliseconds(250)) == std::future_status::ready;
    release.set_value();
    sender.join();
    enqueue.join();
    assert(prompt);
    link.duringSend = nullptr;
    ep.loop();
    assert(link.frames.back().payloads[0].content.pump.power == 0);
}
void telemetry_coalesces_while_waiting_for_ack() {
    Link link;
    Endpoint ep(link);
    ep.begin();
    ep.send(pump(80));
    ep.loop();
    gm::Payload p = gaggimate_Payload_init_zero;
    p.which_content = gaggimate_Payload_volumetric_tag;
    for (int i = 0; i < 100; ++i) {
        p.content.volumetric.volume = i;
        ep.sendUnreliable(p);
    }
    assert(link.frames.size() == 1);
    ep.loop();
    assert(link.frames.back().id == 0 && link.frames.back().payloads_count == 1);
    assert(link.frames.back().payloads[0].content.volumetric.volume == 99);
    ep.send(pump(90));
    link.reset();
    auto count = link.frames.size();
    ep.loop();
    assert(link.frames.size() == count);
}
void phase_stop_preserves_valve_and_newer_configuration() {
    Link link;
    Endpoint ep(link);
    ep.begin();
    gm::Payload boiler = gaggimate_Payload_init_zero;
    boiler.which_content = gaggimate_Payload_boiler_tag;
    boiler.content.boiler.setpoint = 90;
    const std::array<gm::Payload, 2> initial = {pump(80), boiler};
    ep.sendBatch(initial.data(), initial.size());
    ep.loop();
    boiler.content.boiler.setpoint = 95;
    ep.send(boiler);
    gm::Payload valve = gaggimate_Payload_init_zero;
    valve.which_content = gaggimate_Payload_relay_tag;
    valve.content.relay.open = true;
    const std::array<gm::Payload, 2> stop = {pump(0), valve};
    ep.sendStop(stop.data(), stop.size());
    ep.loop();
    const auto &frame = link.frames.back();
    assert(frame.payloads_count == 2 && frame.payloads[0].content.pump.power == 0);
    assert(frame.payloads[1].content.relay.open);
    link.ack(frame.id);
    ep.loop();
    assert(link.frames.back().payloads_count == 1);
    assert(link.frames.back().payloads[0].content.boiler.setpoint == 95);
}
void urgent_batch_does_not_replay_old_temperature() {
    Link link;
    Endpoint ep(link);
    ep.begin();
    gm::Payload boiler = gaggimate_Payload_init_zero;
    boiler.which_content = gaggimate_Payload_boiler_tag;
    boiler.content.boiler.setpoint = 90;
    ep.send(boiler);
    ep.loop();
    boiler.content.boiler.setpoint = 95;
    const std::array<gm::Payload, 2> stop = {pump(0), boiler};
    ep.sendStop(stop.data(), stop.size());
    ep.loop();
    assert(link.frames.back().payloads[1].content.boiler.setpoint == 95);
    link.ack(link.frames.back().id);
    auto count = link.frames.size();
    ep.loop();
    assert(link.frames.size() == count);
}
void exhausted_retries_release_the_next_command() {
    Link link;
    Endpoint ep(link);
    ep.begin();
    int failures = 0;
    ep.onSendFailed([&failures] { ++failures; });
    ep.send(pump(80));
    ep.loop();
    auto oldId = link.frames.back().id;
    ep.send(pump(40));
    for (int i = 0; i < 5; ++i) {
        testClock() += 151;
        ep.loop();
        assert(link.frames.back().id == oldId);
    }
    testClock() += 151;
    ep.loop();
    assert(failures == 1 && link.frames.back().id > oldId);
    assert(link.frames.back().payloads[0].content.pump.power == 40);
}
int main() {
    enqueue_and_callback_never_send();
    stop_supersedes_unacknowledged_start();
    ack_during_send_is_not_lost();
    frame_is_not_sent_after_connection_session_changes();
    blocked_io_does_not_block_stop_enqueue();
    telemetry_coalesces_while_waiting_for_ack();
    phase_stop_preserves_valve_and_newer_configuration();
    exhausted_retries_release_the_next_command();
    urgent_batch_does_not_replay_old_temperature();
    std::cout << "9 endpoint regression tests passed\n";
}
