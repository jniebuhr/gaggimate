#ifndef GITHUBOTA_COMMON_H
#define GITHUBOTA_COMMON_H

#include "semver.h"
#include <HTTPClient.h>
#include <WiFiClientSecure.h>

String get_updated_base_url_via_redirect(WiFiClientSecure &wifi_client, String &release_url);
String get_redirect_location(WiFiClientSecure &wifi_client, String &initial_url);
String get_updated_version_via_txt_file(WiFiClientSecure &wifi_client, String &_release_url);

bool update_required(semver_t _new_version, semver_t _current_version);

#endif
