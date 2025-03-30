
#include <Arduino.h>

#include <sstream>
#include <vector>

#include "semver.h"

using namespace std;

vector<string> split(const string &s, char delim) {
    vector<string> result;
    stringstream ss(s);
    string item;

    while (getline(ss, item, delim)) {
        result.push_back(item);
    }

    return result;
}

semver_t from_string(const string &version) {
    if (version.empty()) {
        return {0, 0, 0, nullptr, nullptr};
    }
    auto numbers = split(version, '.');
    auto major = atoi(numbers.at(0).c_str());
    auto minor = atoi(numbers.at(1).c_str());
    int patch;
    char *prerelease_ptr = nullptr;

    auto split_at = numbers.at(2).find('-');
    if (split_at != string::npos) {
        patch = atoi(numbers.at(2).substr(0, split_at).c_str());
        auto prerelease = numbers.at(2).substr(split_at + 1);
        prerelease_ptr = (char *)malloc(prerelease.length());
        prerelease.copy(prerelease_ptr, prerelease.length());
    } else {
        patch = atoi(numbers.at(2).c_str());
    }

    semver_t _ver = {major, minor, patch, nullptr, prerelease_ptr};

    return _ver;
}

String render_to_string(const semver_t &version) {
    String rendered = String(version.major) + "." + String(version.minor) + "." + String(version.patch);
    if (version.prerelease != nullptr) {
        rendered += "-" + String(version.prerelease);
    }
    return rendered;
}

bool operator>(const semver_t &x, const semver_t &y) { return semver_compare(x, y) > 0; }
