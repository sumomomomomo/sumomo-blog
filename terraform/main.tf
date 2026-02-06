terraform {
  required_providers {
    proxmox = {
      source = "telmate/proxmox"
      version = "3.0.1-rc1"
    }
  }
}

variable "proxmox_api_token_secret" {
  type        = string
  sensitive   = true
}

provider "proxmox" {
  pm_api_url = "https://192.168.1.9:8006/api2/json"
  pm_api_token_id = "terraform-user@ecclesiastes@pam!tf-token"
  pm_api_token_secret = var.proxmox_api_token_secret
  pm_tls_insecure = true
}

resource "proxmox_lxc" "prod_env" {
  target_node = "ecclesiastes"
  hostname = "satono-diamond"
  vmid = 112
  ostemplate   = "local:vztmpl/debian-12-standard_12.2-1_amd64.tar.zst"
  password     = "temp-password"
  unprivileged = true
  start        = true

  cores   = 4
  memory  = 4096
  swap    = 0

  rootfs {
    storage = "local-lvm"
    size    = "8G"
  }

  network {
    name   = "eth0"
    bridge = "vmbr1"
    ip     = "192.168.1.12/24"
    gw     = "192.168.1.1"
  }

  ssh_public_keys = file("~/.ssh/id_ed25519.pub")
}

resource "proxmox_lxc" "dev_env" {
  target_node = "ecclesiastes"
  hostname = "satono-crown"
  vmid = 113
  ostemplate   = "local:vztmpl/debian-12-standard_12.2-1_amd64.tar.zst"
  password     = "temp-password"
  unprivileged = true
  start        = true

  cores   = 4
  memory  = 4096
  swap    = 0

  rootfs {
    storage = "local-lvm"
    size    = "8G"
  }

  network {
    name   = "eth0"
    bridge = "vmbr1"
    ip     = "192.168.1.13/24"
    gw     = "192.168.1.1"
  }

  ssh_public_keys = file("~/.ssh/id_ed25519.pub")
}