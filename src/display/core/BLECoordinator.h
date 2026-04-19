#ifndef BLECOORDINATOR_H
#define BLECOORDINATOR_H

#include <functional>
#include <vector>

class BLECoordinator {
  public:
    using InitCallback = std::function<void()>;

    static BLECoordinator &instance();

    void requestNimBleInit(InitCallback cb);

    void notifyBLEReleased();

    bool isReleased() const { return released; }

  private:
    BLECoordinator();

    bool released;
    bool invoked = false;
    std::vector<InitCallback> pending;
};

#endif // BLECOORDINATOR_H
