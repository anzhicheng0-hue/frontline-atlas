idf_component_register(
    SRCS "main.c"
    INCLUDE_DIRS "."
    PRIV_REQUIRES esp_wifi esp_event esp_netif nvs_flash esp_http_server esp_timer
    EMBED_FILES
        "www/index_html.gz"
        "www/style_css.gz"
        "www/app_mjs.gz"
        "www/core_mjs.gz"
        "www/data_config_json.gz"
        "www/catalog_json.gz"
        "www/leaflet_js.gz"
        "www/leaflet_css.gz"
        "www/leaflet_LICENSE_txt.gz"
)
