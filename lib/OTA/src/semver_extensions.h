#ifndef SEMVER_EXTENSIONS_H
#define SEMVER_EXTENSIONS_H

#include "semver.h"

semver_t from_string(const std::string &version);
String render_to_string(const semver_t &version);
std::vector<std::string> split(const std::string &s, char delim);

bool operator>(const semver_t &x, const semver_t &y);

#endif
