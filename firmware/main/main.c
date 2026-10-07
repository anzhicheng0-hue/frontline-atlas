#include <stdio.h>
#include <stdbool.h>
#include <stdatomic.h>
#include <string.h>
#include "esp_event.h"
#include "esp_http_server.h"
#include "esp_log.h"
#include "esp_netif.h"
#include "esp_wifi.h"
#include "esp_timer.h"
#include "nvs_flash.h"
#include "sdkconfig.h"

static const char *TAG = "frontline";
static bool router_configured;
static atomic_bool router_connected;

#define DECLARE_ASSET(name) \
    extern const unsigned char name##_start[] asm("_binary_" #name "_gz_start"); \
    extern const unsigned char name##_end[] asm("_binary_" #name "_gz_end")
DECLARE_ASSET(index_html);
DECLARE_ASSET(style_css);
DECLARE_ASSET(app_mjs);
DECLARE_ASSET(core_mjs);
DECLARE_ASSET(data_config_json);
DECLARE_ASSET(catalog_json);
DECLARE_ASSET(leaflet_js);
DECLARE_ASSET(leaflet_css);
DECLARE_ASSET(leaflet_LICENSE_txt);

typedef struct { const char *path; const char *type; const unsigned char *start; const unsigned char *end; } web_asset;
static const web_asset assets[] = {
    {"/", "text/html; charset=utf-8", index_html_start, index_html_end},
    {"/index.html", "text/html; charset=utf-8", index_html_start, index_html_end},
    {"/style.css", "text/css; charset=utf-8", style_css_start, style_css_end},
    {"/app.mjs", "text/javascript; charset=utf-8", app_mjs_start, app_mjs_end},
    {"/core.mjs", "text/javascript; charset=utf-8", core_mjs_start, core_mjs_end},
    {"/data-config.json", "application/json; charset=utf-8", data_config_json_start, data_config_json_end},
    {"/catalog.json", "application/json; charset=utf-8", catalog_json_start, catalog_json_end},
    {"/leaflet.js", "text/javascript; charset=utf-8", leaflet_js_start, leaflet_js_end},
    {"/leaflet.css", "text/css; charset=utf-8", leaflet_css_start, leaflet_css_end},
    {"/leaflet-LICENSE.txt", "text/plain; charset=utf-8", leaflet_LICENSE_txt_start, leaflet_LICENSE_txt_end},
};

static esp_err_t serve_asset(httpd_req_t *req) {
    size_t path_len = strcspn(req->uri, "?");
    httpd_resp_set_hdr(req, "X-Served-By", "ESP32-frontline-web-server");
    if (path_len == strlen("/api/status") && strncmp(req->uri, "/api/status", path_len) == 0) {
        char status[160];
        snprintf(status, sizeof(status), "{\"server\":\"ESP32-frontline-web-server\",\"uptimeSeconds\":%lld,\"routerConnected\":%s}",
                 (long long)(esp_timer_get_time() / 1000000), atomic_load(&router_connected) ? "true" : "false");
        httpd_resp_set_type(req, "application/json; charset=utf-8");
        httpd_resp_set_hdr(req, "Cache-Control", "no-store");
        return httpd_resp_sendstr(req, status);
    }
    for (size_t i = 0; i < sizeof(assets) / sizeof(assets[0]); i++) {
        const web_asset *asset = &assets[i];
        if (strlen(asset->path) != path_len || strncmp(req->uri, asset->path, path_len) != 0) continue;
        httpd_resp_set_type(req, asset->type);
        httpd_resp_set_hdr(req, "Content-Encoding", "gzip");
        httpd_resp_set_hdr(req, "Cache-Control", "no-store");
        httpd_resp_set_hdr(req, "X-Content-Type-Options", "nosniff");
        httpd_resp_set_hdr(req, "Referrer-Policy", "strict-origin-when-cross-origin");
        return httpd_resp_send(req, (const char *)asset->start, asset->end - asset->start);
    }
    httpd_resp_send_err(req, HTTPD_404_NOT_FOUND, "File not found");
    return ESP_OK;
}

static void wifi_event(void *arg, esp_event_base_t base, int32_t id, void *data) {
    if (base == WIFI_EVENT && id == WIFI_EVENT_STA_START) {
        esp_wifi_connect();
    } else if (base == WIFI_EVENT && id == WIFI_EVENT_STA_DISCONNECTED && router_configured) {
        atomic_store(&router_connected, false);
        ESP_LOGW(TAG, "Router disconnected. Reconnecting; AP remains available.");
        esp_wifi_connect();
    } else if (base == IP_EVENT && id == IP_EVENT_STA_GOT_IP) {
        atomic_store(&router_connected, true);
        ip_event_got_ip_t *event = data;
        ESP_LOGI(TAG, "Router address: http://" IPSTR, IP2STR(&event->ip_info.ip));
        ESP_LOGI(TAG, "Use a browser connected to the router for online maps.");
    }
}

void app_main(void) {
    esp_err_t err = nvs_flash_init();
    if (err == ESP_ERR_NVS_NO_FREE_PAGES || err == ESP_ERR_NVS_NEW_VERSION_FOUND) {
        ESP_ERROR_CHECK(nvs_flash_erase());
        err = nvs_flash_init();
    }
    ESP_ERROR_CHECK(err);
    ESP_ERROR_CHECK(esp_netif_init());
    ESP_ERROR_CHECK(esp_event_loop_create_default());
    esp_netif_create_default_wifi_ap();
    router_configured = strlen(CONFIG_FRONTLINE_WIFI_SSID) > 0;
    if (router_configured) esp_netif_create_default_wifi_sta();
    wifi_init_config_t init = WIFI_INIT_CONFIG_DEFAULT();
    ESP_ERROR_CHECK(esp_wifi_init(&init));
    ESP_ERROR_CHECK(esp_event_handler_register(WIFI_EVENT, ESP_EVENT_ANY_ID, wifi_event, NULL));
    ESP_ERROR_CHECK(esp_event_handler_register(IP_EVENT, IP_EVENT_STA_GOT_IP, wifi_event, NULL));
    wifi_config_t ap = {0};
    size_t ap_ssid_len = strlen(CONFIG_FRONTLINE_AP_SSID);
    size_t sta_ssid_len = strlen(CONFIG_FRONTLINE_WIFI_SSID);
    size_t password_len = strlen(CONFIG_FRONTLINE_AP_PASSWORD);
    if (password_len < 8 || password_len > 63 || ap_ssid_len == 0 || ap_ssid_len > 32 || sta_ssid_len > 32 || strlen(CONFIG_FRONTLINE_WIFI_PASSWORD) > 63) {
        ESP_LOGE(TAG, "Check Wi-Fi settings: SSID max 32 bytes; AP password 8-63 bytes.");
        return;
    }
    memcpy(ap.ap.ssid, CONFIG_FRONTLINE_AP_SSID, ap_ssid_len);
    snprintf((char *)ap.ap.password, sizeof(ap.ap.password), "%s", CONFIG_FRONTLINE_AP_PASSWORD);
    ap.ap.ssid_len = ap_ssid_len;
    ap.ap.channel = 1;
    ap.ap.max_connection = 4;
    ap.ap.authmode = WIFI_AUTH_WPA2_PSK;
    ESP_ERROR_CHECK(esp_wifi_set_mode(router_configured ? WIFI_MODE_APSTA : WIFI_MODE_AP));
    ESP_ERROR_CHECK(esp_wifi_set_config(WIFI_IF_AP, &ap));
    if (router_configured) {
        wifi_config_t sta = {0};
        memcpy(sta.sta.ssid, CONFIG_FRONTLINE_WIFI_SSID, sta_ssid_len);
        snprintf((char *)sta.sta.password, sizeof(sta.sta.password), "%s", CONFIG_FRONTLINE_WIFI_PASSWORD);
        ESP_ERROR_CHECK(esp_wifi_set_config(WIFI_IF_STA, &sta));
    }
    ESP_ERROR_CHECK(esp_wifi_start());
    httpd_config_t config = HTTPD_DEFAULT_CONFIG();
    config.uri_match_fn = httpd_uri_match_wildcard;
    config.lru_purge_enable = true;
    config.stack_size = 8192;
    config.max_open_sockets = 5;
    httpd_handle_t server = NULL;
    ESP_ERROR_CHECK(httpd_start(&server, &config));
    httpd_uri_t route = {.uri = "/*", .method = HTTP_GET, .handler = serve_asset, .user_ctx = NULL};
    ESP_ERROR_CHECK(httpd_register_uri_handler(server, &route));
    ESP_LOGI(TAG, "Hotspot: %s. Open http://192.168.4.1", CONFIG_FRONTLINE_AP_SSID);
    ESP_LOGI(TAG, "External maps require internet on the browser. This hotspot does not provide routing/NAT.");
}
