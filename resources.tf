resource "cloudflare_worker_route" "uploads" {
    zone_id = var.CF_ZONE_ID
    pattern = var.route
    script_name = cloudflare_worker_script.prod_resizer.name
}

resource "cloudflare_worker_script" "prod_resizer" {
    name = "prod_resizer"
    content = file("resizer.js")
}