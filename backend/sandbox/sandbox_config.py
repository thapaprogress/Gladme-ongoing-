SANDBOX_LIMITS = {
    "memory": "128m",
    "cpu_period": 100000,
    "cpu_quota": 50000,
    "timeout": 30,
    "network_disabled": True,
    "read_only": True,
    "tmpfs_size": "50m",
    "pids_limit": 50,
    "workspace_mount": "/workspace",
}

SANDBOX_IMAGE = "gladme-runner:latest"
SANDBOX_TYPE = "docker"
