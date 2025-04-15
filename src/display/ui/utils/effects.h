#ifndef EFFECTS_H
#define EFFECTS_H
#pragma once

#include <tuple>
#include <functional>
#include <vector>
#include <memory>
#include <type_traits>


class EffectBase {
public:
    virtual void evaluate(lv_obj_t *screen) = 0;
    virtual ~EffectBase() = default;
};

template <typename... Deps>
class Effect : public EffectBase {
public:
    using Callback = std::function<void()>;
    using DependencyTuple = std::tuple<Deps*...>;
    using ValueTuple = std::tuple<std::decay_t<Deps>...>;

    Effect(lv_obj_t *screen, Callback callback, Deps*... deps)
        : callback_(std::move(callback)),
          screen_(screen),
          dep_ptrs_(deps...),
          first_run_(true) {
        read_current_values(last_values_);
    }

    void evaluate(lv_obj_t *screen) {
        if (screen_ != screen) return;
        ValueTuple current_values;
        read_current_values(current_values);

        if (first_run_ || current_values != last_values_) {
            callback_();
            last_values_ = current_values;
            first_run_ = false;
        }
    }

private:
    template <std::size_t... I>
    void read_current_values_impl(ValueTuple& out, std::index_sequence<I...>) const {
        ((std::get<I>(out) = *std::get<I>(dep_ptrs_)), ...);
    }

    void read_current_values(ValueTuple& out) const {
        read_current_values_impl(out, std::index_sequence_for<Deps...>{});
    }

    Callback callback_;
    lv_obj_t *screen_;
    DependencyTuple dep_ptrs_;
    ValueTuple last_values_;
    bool first_run_;
};

class EffectManager {
public:
    template <typename... Deps>
    void use_effect(lv_obj_t *screen, std::function<void()> callback, Deps*... deps) {
        auto effect = std::make_shared<Effect<Deps...>>(screen, callback, deps...);
        effects_.emplace_back(std::move(effect));
    }

    void evaluate_all(lv_obj_t *screen) {
        for (auto& eff : effects_) {
            if (eff) eff->evaluate(screen);
        }
    }

private:
    std::vector<std::shared_ptr<EffectBase>> effects_;
};



#endif
