/**
 * FormattedError provides a user-friendly title, message, and actionable hint
 * for raw backend, SSH, SFTP, and OS errors.
 */
export interface FormattedError {
  title: string;
  message: string;
  hint?: string;
  raw?: string;
}

/**
 * formatErrorMessage parses raw error strings or Error objects from Go/Wails/SSH/SFTP
 * and translates them into actionable, human-friendly error descriptions.
 */
export function formatErrorMessage(err: unknown, context?: string): FormattedError {
  if (!err) {
    return {
      title: 'Unknown Error',
      message: 'An unexpected error occurred without details.',
    };
  }

  const raw =
    typeof err === 'string'
      ? err
      : (err as any)?.message || (err as any)?.error || String(err);

  const lower = raw.toLowerCase();

  // 1. SSH Authentication Errors
  if (
    lower.includes('unable to authenticate') ||
    lower.includes('no supported methods remain') ||
    lower.includes('auth failed') ||
    lower.includes('permission denied (publickey') ||
    lower.includes('permission denied (password')
  ) {
    return {
      title: 'Authentication Failed',
      message: 'The remote server rejected your login credentials.',
      hint: 'Verify that the username is correct and your password or private key passphrase matches.',
      raw,
    };
  }

  // 2. Private Key Parse Errors
  if (
    lower.includes('failed to parse private key') ||
    lower.includes('passphrase') ||
    lower.includes('encrypted key')
  ) {
    return {
      title: 'Invalid Private Key',
      message: 'Could not load or decrypt the specified SSH private key.',
      hint: 'If the key is encrypted, make sure to enter its passphrase in the password field.',
      raw,
    };
  }

  // 3. Connection Refused
  if (
    lower.includes('connection refused') ||
    lower.includes('connectex: no connection could be made')
  ) {
    return {
      title: 'Connection Refused',
      message: 'The target server actively rejected the connection attempt.',
      hint: 'Check if the SSH daemon (sshd) is running and listening on the specified port, and that firewall rules permit traffic.',
      raw,
    };
  }

  // 4. Host Not Found / DNS Lookup Failure
  if (
    lower.includes('no such host') ||
    lower.includes('lookup') ||
    lower.includes('name or service not known')
  ) {
    return {
      title: 'Host Not Found',
      message: 'The hostname or IP address could not be resolved.',
      hint: 'Double check the spelling of the hostname or verify that your DNS and network connection are active.',
      raw,
    };
  }

  // 5. Connection Timeout
  if (
    lower.includes('i/o timeout') ||
    lower.includes('timed out') ||
    lower.includes('deadline exceeded')
  ) {
    return {
      title: 'Connection Timed Out',
      message: 'The remote server did not respond within the 15-second timeout limit.',
      hint: 'Ensure the host is online, reachable from your network, and not blocked by a firewall or VPN.',
      raw,
    };
  }

  // 6. Network Unreachable / Route
  if (
    lower.includes('network is unreachable') ||
    lower.includes('no route to host')
  ) {
    return {
      title: 'Network Unreachable',
      message: 'No route to the specified host was found.',
      hint: 'Check your internet connection, VPN, or local network gateway.',
      raw,
    };
  }

  // 7. Host Key Mismatch / Untrusted
  if (lower.includes('host key not yet trusted')) {
    return {
      title: 'Host Key Unverified',
      message: 'The server presented a host key that has not yet been accepted.',
      hint: 'Please review and accept the host key fingerprint to establish trust.',
      raw,
    };
  }

  if (
    lower.includes('host key changed') ||
    lower.includes('host key mismatch') ||
    lower.includes('fingerprint mismatch')
  ) {
    return {
      title: 'Security Warning: Host Key Changed',
      message: 'The host key presented by the server differs from the previously trusted key.',
      hint: 'This could indicate a server re-installation or a Man-in-the-Middle security risk.',
      raw,
    };
  }

  // 8. SFTP Permission Denied
  if (
    lower.includes('sftp: "permission denied"') ||
    (lower.includes('permission denied') && !lower.includes('ssh:'))
  ) {
    return {
      title: 'Permission Denied',
      message: 'You do not have sufficient permissions for this remote file or directory.',
      hint: 'Check Linux file ownership and permissions (e.g. chmod / chown) on the server.',
      raw,
    };
  }

  // 9. SFTP File Not Found
  if (
    lower.includes('file does not exist') ||
    lower.includes('no such file or directory')
  ) {
    return {
      title: 'File Not Found',
      message: 'The requested remote path does not exist.',
      hint: 'The file or folder may have been moved or deleted by another user.',
      raw,
    };
  }

  // 10. File Conflict (Concurrent Modification)
  if (lower.includes('modified on remote server')) {
    return {
      title: 'Concurrent Modification Conflict',
      message: 'This file has been modified on the remote server since you opened it.',
      hint: 'You can choose to overwrite the remote changes or reload the latest content.',
      raw,
    };
  }

  // 11. File Size Exceeded
  if (lower.includes('exceeds maximum limit') || lower.includes('file size')) {
    return {
      title: 'File Too Large',
      message: 'This file exceeds the maximum editor buffer limit (10 MB).',
      hint: 'Editing very large files in the UI can cause performance issues. Use a command line editor or SFTP download.',
      raw,
    };
  }

  // 12. Session Inactive / Disconnected
  if (
    lower.includes('session not found') ||
    lower.includes('is disconnected') ||
    lower.includes('client is closed')
  ) {
    return {
      title: 'Session Disconnected',
      message: 'The SSH/SFTP session is no longer active.',
      hint: 'Reconnect to the remote server to continue browsing or editing files.',
      raw,
    };
  }

  // 13. System Authorization Cancelled (Update / pkexec)
  if (
    lower.includes('not authorized') ||
    lower.includes('dismissed') ||
    lower.includes('cancelled by user')
  ) {
    return {
      title: 'Authorization Cancelled',
      message: 'System authorization was cancelled by the user.',
      hint: 'Authentication is required to install desktop packages in system directories.',
      raw,
    };
  }

  // Default fallback with optional context prefix
  const title = context ? `${context} Failed` : 'Operation Failed';
  return {
    title,
    message: raw.replace(/^[A-Za-z0-9_-]+: /, ''), // Strip technical Go prefix if present
    raw,
  };
}
