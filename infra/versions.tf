terraform {
  required_version = "~> 1.17.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "6.73.0"
    }
  }
  # The bucket and region come from -backend-config. Locking uses a lock file in the bucket.
  backend "s3" {
    key          = "northmoor/terraform.tfstate"
    encrypt      = true
    use_lockfile = true
  }
}

provider "aws" {
  region              = var.region
  allowed_account_ids = [var.account_id]
  default_tags {
    tags = {
      project = var.project
      env     = var.env
    }
  }
}
