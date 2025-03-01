terraform {
    required_providers {
    cloudflare = {
        source = "cloudflare/cloudflare"
        version = "~> 2.0"
        }
    }
}

provider "cloudflare" {
    email      = var.CF_EMAIL
    api_key    = var.CF_API_KEY
    account_id = var.CF_ACCOUNT_ID
}