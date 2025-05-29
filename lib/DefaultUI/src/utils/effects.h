#ifndef EFFECTS_H
#define EFFECTS_H
#pragma once

#include <functional>
#include <memory>
#include <tuple>
#include <type_traits>
#include <vector>

class EffectBase {
  public:
    virtual void evaluate() = 0;
    virtual ~EffectBase() = default;
};

template <typename... Deps> class Effect : public EffectBase {
  public:
    using Condition = std::function<bool()>;
    using Callback = std::function<void()>;
    using DependencyTuple = std::tuple<Deps *...>;
    using ValueTuple = std::tuple<std::decay_t<Deps>...>;

    Effect(Condition condition, Callback callback, Deps *...deps)
        : condition_(std::move(condition)), callback_(std::move(callback)), dep_ptrs_(deps...), first_run_(true) {
        read_current_values(last_values_);
    }

    void evaluate() {
        if (!condition_()) {
            first_run_ = true;
            return;
        }
        ValueTuple current_values;
        read_current_values(current_values);

        if (first_run_ || current_values != last_values_) {
            callback_();
            last_values_ = current_values;
            first_run_ = false;
        }
    }

  private:
    template <std::size_t... I> void read_current_values_impl(ValueTuple &out, std::index_sequence<I...>) const {
        ((std::get<I>(out) = *std::get<I>(dep_ptrs_)), ...);
    }

    void read_current_values(ValueTuple &out) const { read_current_values_impl(out, std::index_sequence_for<Deps...>{}); }

    Condition condition_;
    Callback callback_;
    DependencyTuple dep_ptrs_;
    ValueTuple last_values_;
    bool first_run_;
};

class EffectManager {
  public:
    template <typename... Deps> void use_effect(std::function<bool()> condition, std::function<void()> callback, Deps *...deps) {
        auto effect = std::make_shared<Effect<Deps...>>(condition, callback, deps...);
        effects_.emplace_back(std::move(effect));
    }

    void evaluate_all() {
        for (auto &eff : effects_) {
            if (eff)
                eff->evaluate();
        }
    }

  private:
    std::vector<std::shared_ptr<EffectBase>> effects_;
};

#endif
