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
	    remote_host: string;
	    remote_port: number;
	    name: string;
	
	    static createFrom(source: any = {}) {
	        return new ForwardedPortConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.local_port = source["local_port"];
	        this.remote_host = source["remote_host"];
	        this.remote_port = source["remote_port"];
	        this.name = source["name"];
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

export namespace tunnel {
	
	export class TunnelInfo {
	    id: string;
	    sessionId: string;
	    localPort: number;
	    remoteHost: string;
	    remotePort: number;
	    name: string;
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
	        this.remoteHost = source["remoteHost"];
	        this.remotePort = source["remotePort"];
	        this.name = source["name"];
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

