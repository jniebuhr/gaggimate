// FlowEstimator.h
#ifndef FLOW_ESTIMATOR_H
#define FLOW_ESTIMATOR_H

class FlowEstimator {
  public:
    // Estimates puck flow from pump flow and pressure derivative.
    explicit FlowEstimator(float dt);

    void update(float pumpFlowMlPerS, float pressureBar, float pressureDerivativeBarPerS, bool valveOpen);

    float getFlow() const { return _filteredFlow; }

  private:
    float _dt;
    float _filteredFlow = 0.0f;

    float _compliance = 3.0f;   // ml / bar
    float _filterCutoff = 1.0f; // Hz

    static void lowPass(float &state, float input, float cutoff, float dt);
};

#endif
