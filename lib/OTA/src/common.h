#ifndef GITHUBOTA_COMMON_H
#define GITHUBOTA_COMMON_H

#include "semver.h"
#include <HTTPClient.h>
#include <HTTPUpdate.h>
#include <Update.h>
#include <WiFiClientSecure.h>

using Updater = HTTPUpdate;

String get_updated_base_url_via_redirect(WiFiClientSecure &wifi_client, String &release_url);
String get_redirect_location(WiFiClientSecure &wifi_client, String &initial_url);
String get_updated_version_via_txt_file(WiFiClientSecure &wifi_client, String &_release_url);

void print_update_result(Updater updater, HTTPUpdateResult result, const char *TAG);

bool update_required(semver_t _new_version, semver_t _current_version);

void update_started();
void update_finished();
void update_error(int err);

#endif
