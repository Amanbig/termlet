export namespace connections {
	
	export class SessionSummary {
	    id: string;
	    profile_id: string;
	    profile_name: string;
	    host: string;
	    port: number;
	    username: string;
	    connected_at: number;
	    start_directory: string;
	    is_alive: boolean;
	    status: string;
	    auto_reconnect: boolean;
	    jump_host_name?: string;
	
	    static createFrom(source: any = {}) {
	        return new SessionSummary(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.profile_id = source["profile_id"];
	        this.profile_name = source["profile_name"];
	        this.host = source["host"];
	        this.port = source["port"];
	        this.username = source["username"];
	        this.connected_at = source["connected_at"];
	        this.start_directory = source["start_directory"];
	        this.is_alive = source["is_alive"];
	        this.status = source["status"];
	        this.auto_reconnect = source["auto_reconnect"];
	        this.jump_host_name = source["jump_host_name"];
	    }
	}

}

export namespace main {
	
	export class ConnectResponse {
	    success: boolean;
	    session?: connections.SessionSummary;
	    host_key_prompt?: models.HostKeyPrompt;
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new ConnectResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.session = this.convertValues(source["session"], connections.SessionSummary);
	        this.host_key_prompt = this.convertValues(source["host_key_prompt"], models.HostKeyPrompt);
	        this.error = source["error"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

export namespace models {
	
	export class FileDiffItem {
	    path: string;
	    status: string;
	    local_size: number;
	    remote_size: number;
	    local_mod_time: number;
	    remote_mod_time: number;
	    is_dir: boolean;
	
	    static createFrom(source: any = {}) {
	        return new FileDiffItem(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.path = source["path"];
	        this.status = source["status"];
	        this.local_size = source["local_size"];
	        this.remote_size = source["remote_size"];
	        this.local_mod_time = source["local_mod_time"];
	        this.remote_mod_time = source["remote_mod_time"];
	        this.is_dir = source["is_dir"];
	    }
	}
	export class DirectoryCompareResult {
	    remote_dir: string;
	    local_dir: string;
	    total_files: number;
	    matches: number;
	    differences: number;
	    remote_only: number;
	    local_only: number;
	    items: FileDiffItem[];
	
	    static createFrom(source: any = {}) {
	        return new DirectoryCompareResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.remote_dir = source["remote_dir"];
	        this.local_dir = source["local_dir"];
	        this.total_files = source["total_files"];
	        this.matches = source["matches"];
	        this.differences = source["differences"];
	        this.remote_only = source["remote_only"];
	        this.local_only = source["local_only"];
	        this.items = this.convertValues(source["items"], FileDiffItem);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class FileContent {
	    path: string;
	    content: string;
	    size: number;
	    mod_time: number;
	    permissions: number;
	    is_binary: boolean;
	
	    static createFrom(source: any = {}) {
	        return new FileContent(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.path = source["path"];
	        this.content = source["content"];
	        this.size = source["size"];
	        this.mod_time = source["mod_time"];
	        this.permissions = source["permissions"];
	        this.is_binary = source["is_binary"];
	    }
	}
	
	export class ForwardedPortConfig {
	    id: string;
	    local_port: number;
	    local_host?: string;
	    remote_host?: string;
	    remote_port?: number;
	    name: string;
	    type?: string;
	
	    static createFrom(source: any = {}) {
	        return new ForwardedPortConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.local_port = source["local_port"];
	        this.local_host = source["local_host"];
	        this.remote_host = source["remote_host"];
	        this.remote_port = source["remote_port"];
	        this.name = source["name"];
	        this.type = source["type"];
	    }
	}
	export class GenerateSSHKeyRequest {
	    type: string;
	    bits: number;
	    comment: string;
	    passphrase: string;
	    saveToDisk: boolean;
	    targetFilename: string;
	    overwrite: boolean;
	
	    static createFrom(source: any = {}) {
	        return new GenerateSSHKeyRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.type = source["type"];
	        this.bits = source["bits"];
	        this.comment = source["comment"];
	        this.passphrase = source["passphrase"];
	        this.saveToDisk = source["saveToDisk"];
	        this.targetFilename = source["targetFilename"];
	        this.overwrite = source["overwrite"];
	    }
	}
	export class GeneratedSSHKey {
	    publicKey: string;
	    privateKey: string;
	    fingerprint: string;
	    keyType: string;
	    bits: number;
	    comment: string;
	    savedPath: string;
	    publicKeyPath: string;
	    randomart: string;
	
	    static createFrom(source: any = {}) {
	        return new GeneratedSSHKey(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.publicKey = source["publicKey"];
	        this.privateKey = source["privateKey"];
	        this.fingerprint = source["fingerprint"];
	        this.keyType = source["keyType"];
	        this.bits = source["bits"];
	        this.comment = source["comment"];
	        this.savedPath = source["savedPath"];
	        this.publicKeyPath = source["publicKeyPath"];
	        this.randomart = source["randomart"];
	    }
	}
	export class HostKeyPrompt {
	    hostname: string;
	    address: string;
	    key_type: string;
	    fingerprint: string;
	    status: string;
	    message: string;
	
	    static createFrom(source: any = {}) {
	        return new HostKeyPrompt(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.hostname = source["hostname"];
	        this.address = source["address"];
	        this.key_type = source["key_type"];
	        this.fingerprint = source["fingerprint"];
	        this.status = source["status"];
	        this.message = source["message"];
	    }
	}
	export class KnownHostEntry {
	    host: string;
	    key_type: string;
	    fingerprint: string;
	    public_key: string;
	    comment: string;
	    source: string;
	    line_number: number;
	
	    static createFrom(source: any = {}) {
	        return new KnownHostEntry(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.host = source["host"];
	        this.key_type = source["key_type"];
	        this.fingerprint = source["fingerprint"];
	        this.public_key = source["public_key"];
	        this.comment = source["comment"];
	        this.source = source["source"];
	        this.line_number = source["line_number"];
	    }
	}
	export class NetworkDiagResult {
	    tool: string;
	    target: string;
	    output: string;
	    exit_code: number;
	    duration_ms: number;
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new NetworkDiagResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.tool = source["tool"];
	        this.target = source["target"];
	        this.output = source["output"];
	        this.exit_code = source["exit_code"];
	        this.duration_ms = source["duration_ms"];
	        this.error = source["error"];
	    }
	}
	export class ProcessInfo {
	    pid: string;
	    user: string;
	    cpu: string;
	    mem: string;
	    command: string;
	
	    static createFrom(source: any = {}) {
	        return new ProcessInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.pid = source["pid"];
	        this.user = source["user"];
	        this.cpu = source["cpu"];
	        this.mem = source["mem"];
	        this.command = source["command"];
	    }
	}
	export class Profile {
	    id: string;
	    name: string;
	    host: string;
	    port: number;
	    username: string;
	    auth_method: string;
	    key_path?: string;
	    start_directory?: string;
	    port_forwards?: ForwardedPortConfig[];
	    keepalive_interval?: number;
	    auto_reconnect?: boolean;
	    jump_host_profile_id?: string;
	    proxy_jump?: string;
	    created_at: number;
	    updated_at: number;
	
	    static createFrom(source: any = {}) {
	        return new Profile(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.host = source["host"];
	        this.port = source["port"];
	        this.username = source["username"];
	        this.auth_method = source["auth_method"];
	        this.key_path = source["key_path"];
	        this.start_directory = source["start_directory"];
	        this.port_forwards = this.convertValues(source["port_forwards"], ForwardedPortConfig);
	        this.keepalive_interval = source["keepalive_interval"];
	        this.auto_reconnect = source["auto_reconnect"];
	        this.jump_host_profile_id = source["jump_host_profile_id"];
	        this.proxy_jump = source["proxy_jump"];
	        this.created_at = source["created_at"];
	        this.updated_at = source["updated_at"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class RemoteExecResult {
	    output: string;
	    cwd: string;
	    exit_code: number;
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new RemoteExecResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.output = source["output"];
	        this.cwd = source["cwd"];
	        this.exit_code = source["exit_code"];
	        this.error = source["error"];
	    }
	}
	export class RemoteFile {
	    name: string;
	    path: string;
	    is_dir: boolean;
	    size: number;
	    mod_time: number;
	    permissions: number;
	
	    static createFrom(source: any = {}) {
	        return new RemoteFile(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.path = source["path"];
	        this.is_dir = source["is_dir"];
	        this.size = source["size"];
	        this.mod_time = source["mod_time"];
	        this.permissions = source["permissions"];
	    }
	}
	export class SSHKeyInfo {
	    name: string;
	    path: string;
	    publicKeyPath: string;
	    publicKey: string;
	    fingerprint: string;
	    keyType: string;
	    comment: string;
	    hasPrivateKey: boolean;
	    isEncrypted: boolean;
	    modTime: number;
	    size: number;
	
	    static createFrom(source: any = {}) {
	        return new SSHKeyInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.path = source["path"];
	        this.publicKeyPath = source["publicKeyPath"];
	        this.publicKey = source["publicKey"];
	        this.fingerprint = source["fingerprint"];
	        this.keyType = source["keyType"];
	        this.comment = source["comment"];
	        this.hasPrivateKey = source["hasPrivateKey"];
	        this.isEncrypted = source["isEncrypted"];
	        this.modTime = source["modTime"];
	        this.size = source["size"];
	    }
	}
	export class Snippet {
	    id: string;
	    title: string;
	    command: string;
	    description?: string;
	    category?: string;
	    tags?: string[];
	    // Go type: time
	    created_at: any;
	    // Go type: time
	    updated_at: any;
	
	    static createFrom(source: any = {}) {
	        return new Snippet(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.title = source["title"];
	        this.command = source["command"];
	        this.description = source["description"];
	        this.category = source["category"];
	        this.tags = source["tags"];
	        this.created_at = this.convertValues(source["created_at"], null);
	        this.updated_at = this.convertValues(source["updated_at"], null);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class SyncAction {
	    path: string;
	    direction: string;
	    is_dir: boolean;
	
	    static createFrom(source: any = {}) {
	        return new SyncAction(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.path = source["path"];
	        this.direction = source["direction"];
	        this.is_dir = source["is_dir"];
	    }
	}
	export class SyncResult {
	    transferred_files: number;
	    transferred_bytes: number;
	    errors?: string[];
	    success: boolean;
	
	    static createFrom(source: any = {}) {
	        return new SyncResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.transferred_files = source["transferred_files"];
	        this.transferred_bytes = source["transferred_bytes"];
	        this.errors = source["errors"];
	        this.success = source["success"];
	    }
	}
	export class SystemStats {
	    hostname: string;
	    os: string;
	    kernel: string;
	    uptime: string;
	    load_avg: string;
	    cpu_usage: number;
	    mem_total_mb: number;
	    mem_used_mb: number;
	    mem_free_mb: number;
	    swap_total_mb: number;
	    swap_used_mb: number;
	    disk_total: string;
	    disk_used: string;
	    disk_free: string;
	    disk_usage_percent: string;
	    top_processes: ProcessInfo[];
	    raw_output?: string;
	
	    static createFrom(source: any = {}) {
	        return new SystemStats(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.hostname = source["hostname"];
	        this.os = source["os"];
	        this.kernel = source["kernel"];
	        this.uptime = source["uptime"];
	        this.load_avg = source["load_avg"];
	        this.cpu_usage = source["cpu_usage"];
	        this.mem_total_mb = source["mem_total_mb"];
	        this.mem_used_mb = source["mem_used_mb"];
	        this.mem_free_mb = source["mem_free_mb"];
	        this.swap_total_mb = source["swap_total_mb"];
	        this.swap_used_mb = source["swap_used_mb"];
	        this.disk_total = source["disk_total"];
	        this.disk_used = source["disk_used"];
	        this.disk_free = source["disk_free"];
	        this.disk_usage_percent = source["disk_usage_percent"];
	        this.top_processes = this.convertValues(source["top_processes"], ProcessInfo);
	        this.raw_output = source["raw_output"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

export namespace sftpclient {
	
	export class SaveResult {
	    path: string;
	    size: number;
	    mod_time: number;
	
	    static createFrom(source: any = {}) {
	        return new SaveResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.path = source["path"];
	        this.size = source["size"];
	        this.mod_time = source["mod_time"];
	    }
	}

}

export namespace transfer {
	
	export class Item {
	    id: string;
	    sessionId: string;
	    name: string;
	    type: string;
	    status: string;
	    sourcePath: string;
	    destPath: string;
	    bytesTransferred: number;
	    totalBytes: number;
	    percentage: number;
	    speedBytesPerSec: number;
	    error?: string;
	    startTime: number;
	    endTime?: number;
	
	    static createFrom(source: any = {}) {
	        return new Item(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.sessionId = source["sessionId"];
	        this.name = source["name"];
	        this.type = source["type"];
	        this.status = source["status"];
	        this.sourcePath = source["sourcePath"];
	        this.destPath = source["destPath"];
	        this.bytesTransferred = source["bytesTransferred"];
	        this.totalBytes = source["totalBytes"];
	        this.percentage = source["percentage"];
	        this.speedBytesPerSec = source["speedBytesPerSec"];
	        this.error = source["error"];
	        this.startTime = source["startTime"];
	        this.endTime = source["endTime"];
	    }
	}

}

export namespace tunnel {
	
	export class PortHealthStatus {
	    tunnelId: string;
	    localPort: number;
	    status: string;
	    statusCode?: number;
	    statusText?: string;
	    protocol: string;
	    latencyMs: number;
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new PortHealthStatus(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.tunnelId = source["tunnelId"];
	        this.localPort = source["localPort"];
	        this.status = source["status"];
	        this.statusCode = source["statusCode"];
	        this.statusText = source["statusText"];
	        this.protocol = source["protocol"];
	        this.latencyMs = source["latencyMs"];
	        this.error = source["error"];
	    }
	}
	export class TunnelInfo {
	    id: string;
	    sessionId: string;
	    localPort: number;
	    localHost?: string;
	    remoteHost: string;
	    remotePort: number;
	    name: string;
	    type: string;
	    status: string;
	    errorMsg?: string;
	    createdAt: number;
	    connections: number;
	
	    static createFrom(source: any = {}) {
	        return new TunnelInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.sessionId = source["sessionId"];
	        this.localPort = source["localPort"];
	        this.localHost = source["localHost"];
	        this.remoteHost = source["remoteHost"];
	        this.remotePort = source["remotePort"];
	        this.name = source["name"];
	        this.type = source["type"];
	        this.status = source["status"];
	        this.errorMsg = source["errorMsg"];
	        this.createdAt = source["createdAt"];
	        this.connections = source["connections"];
	    }
	}

}

export namespace updater {
	
	export class AssetOption {
	    name: string;
	    downloadUrl: string;
	    type: string;
	    size: number;
	    isDefault: boolean;
	
	    static createFrom(source: any = {}) {
	        return new AssetOption(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.downloadUrl = source["downloadUrl"];
	        this.type = source["type"];
	        this.size = source["size"];
	        this.isDefault = source["isDefault"];
	    }
	}
	export class DownloadProgress {
	    percentage: number;
	    totalBytes: number;
	    readBytes: number;
	    status: string;
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new DownloadProgress(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.percentage = source["percentage"];
	        this.totalBytes = source["totalBytes"];
	        this.readBytes = source["readBytes"];
	        this.status = source["status"];
	        this.error = source["error"];
	    }
	}
	export class UpdateInfo {
	    available: boolean;
	    currentVersion: string;
	    latestVersion: string;
	    releaseName: string;
	    releaseNotes: string;
	    publishedAt: string;
	    releaseUrl: string;
	    downloadUrl: string;
	    assetFileName: string;
	    platform: string;
	    installType: string;
	    needsElevation: boolean;
	    availableAssets: AssetOption[];
	    current_version?: string;
	    latest_version?: string;
	    release_name?: string;
	    release_notes?: string;
	    published_at?: string;
	    release_url?: string;
	    download_url?: string;
	
	    static createFrom(source: any = {}) {
	        return new UpdateInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.available = source["available"];
	        this.currentVersion = source["currentVersion"];
	        this.latestVersion = source["latestVersion"];
	        this.releaseName = source["releaseName"];
	        this.releaseNotes = source["releaseNotes"];
	        this.publishedAt = source["publishedAt"];
	        this.releaseUrl = source["releaseUrl"];
	        this.downloadUrl = source["downloadUrl"];
	        this.assetFileName = source["assetFileName"];
	        this.platform = source["platform"];
	        this.installType = source["installType"];
	        this.needsElevation = source["needsElevation"];
	        this.availableAssets = this.convertValues(source["availableAssets"], AssetOption);
	        this.current_version = source["current_version"];
	        this.latest_version = source["latest_version"];
	        this.release_name = source["release_name"];
	        this.release_notes = source["release_notes"];
	        this.published_at = source["published_at"];
	        this.release_url = source["release_url"];
	        this.download_url = source["download_url"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

