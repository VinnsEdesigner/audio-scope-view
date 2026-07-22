#![allow(dead_code)]

use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};

use tokio::sync::RwLock;
use uuid::Uuid;

#[derive(Debug, Clone)]
pub struct ApiKey {
    pub id: String,
    pub key: String,
    pub name: String,
    pub created_at: Instant,
    pub expires_at: Option<Instant>,
    pub rate_limit_per_minute: u32,
    pub last_used_at: Option<Instant>,
}

impl ApiKey {
    pub fn generate(name: String) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            key: Uuid::new_v4().to_string().replace("-", ""),
            name,
            created_at: Instant::now(),
            expires_at: None,
            rate_limit_per_minute: 60,
            last_used_at: None,
        }
    }

    pub fn with_expiry(mut self, duration: Duration) -> Self {
        self.expires_at = Some(self.created_at + duration);
        self
    }

    pub fn with_rate_limit(mut self, limit: u32) -> Self {
        self.rate_limit_per_minute = limit;
        self
    }

    pub fn is_valid(&self) -> bool {
        if let Some(expires) = self.expires_at
            && Instant::now() >= expires
        {
            return false;
        }
        true
    }

    pub fn mark_used(&mut self) {
        self.last_used_at = Some(Instant::now());
    }
}

pub struct ApiKeyStore {
    keys: Arc<RwLock<HashMap<String, ApiKey>>>,
    key_ids: Arc<RwLock<HashMap<String, String>>>,
    rate_limits: Arc<RwLock<HashMap<String, Vec<Instant>>>>,
}

impl ApiKeyStore {
    pub fn new() -> Self {
        Self {
            keys: Arc::new(RwLock::new(HashMap::new())),
            key_ids: Arc::new(RwLock::new(HashMap::new())),
            rate_limits: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn create_key(&self, name: String) -> ApiKey {
        let api_key = ApiKey::generate(name);
        let key_hash = hash_key(&api_key.key);
        let key_hash_for_ids = key_hash.clone();
        
        let mut keys = self.keys.write().await;
        let mut key_ids = self.key_ids.write().await;
        
        keys.insert(key_hash, api_key.clone());
        key_ids.insert(api_key.id.clone(), key_hash_for_ids);
        
        api_key
    }

    pub async fn create_key_with_expiry(&self, name: String, expiry: Duration) -> ApiKey {
        let api_key = ApiKey::generate(name).with_expiry(expiry);
        let key_hash = hash_key(&api_key.key);
        let key_hash_for_ids = key_hash.clone();
        
        let mut keys = self.keys.write().await;
        let mut key_ids = self.key_ids.write().await;
        
        keys.insert(key_hash, api_key.clone());
        key_ids.insert(api_key.id.clone(), key_hash_for_ids);
        
        api_key
    }

    pub async fn delete_key(&self, key_id: &str) -> bool {
        let mut keys = self.keys.write().await;
        let mut key_ids = self.key_ids.write().await;
        
        if let Some(key_hash) = key_ids.remove(key_id) {
            keys.remove(&key_hash);
            true
        } else {
            false
        }
    }

    pub async fn list_keys(&self) -> Vec<ApiKeyInfo> {
        let keys = self.keys.read().await;
        keys.values()
            .map(|k| ApiKeyInfo {
                id: k.id.clone(),
                name: k.name.clone(),
                created_at: k.created_at,
                expires_at: k.expires_at,
                last_used_at: k.last_used_at,
                rate_limit_per_minute: k.rate_limit_per_minute,
            })
            .collect()
    }

    pub async fn validate(&self, key: &str) -> Option<ApiKey> {
        let key_hash = hash_key(key);
        let mut keys = self.keys.write().await;
        
        if let Some(api_key) = keys.get_mut(&key_hash)
            && api_key.is_valid()
        {
            api_key.mark_used();
            return Some(api_key.clone());
        }
        None
    }

    pub async fn check_rate_limit(&self, key: &str, limit: u32) -> bool {
        let mut rate_limits = self.rate_limits.write().await;
        let now = Instant::now();
        let window = Duration::from_secs(60);

        let timestamps = rate_limits.entry(key.to_string()).or_insert_with(Vec::new);
        
        timestamps.retain(|&t| now.duration_since(t) < window);
        
        if timestamps.len() >= limit as usize {
            return false;
        }

        timestamps.push(now);
        true
    }

    pub async fn get_key_info(&self, key_id: &str) -> Option<ApiKeyInfo> {
        let key_ids = self.key_ids.read().await;
        let keys = self.keys.read().await;
        
        if let Some(key_hash) = key_ids.get(key_id)
            && let Some(k) = keys.get(key_hash)
        {
            return Some(ApiKeyInfo {
                id: k.id.clone(),
                name: k.name.clone(),
                created_at: k.created_at,
                expires_at: k.expires_at,
                last_used_at: k.last_used_at,
                rate_limit_per_minute: k.rate_limit_per_minute,
            });
        }
        None
    }

    pub async fn update_key_rate_limit(&self, key_id: &str, rate_limit: u32) -> bool {
        let key_ids = self.key_ids.read().await;
        let mut keys = self.keys.write().await;
        
        if let Some(key_hash) = key_ids.get(key_id)
            && let Some(key) = keys.get_mut(key_hash) {
                key.rate_limit_per_minute = rate_limit;
                return true;
            }
        false
    }

    pub async fn update_key_name(&self, key_id: &str, name: &str) -> bool {
        let key_ids = self.key_ids.read().await;
        let mut keys = self.keys.write().await;
        
        if let Some(key_hash) = key_ids.get(key_id)
            && let Some(key) = keys.get_mut(key_hash) {
                key.name = name.to_string();
                return true;
            }
        false
    }

    pub async fn update_key_expiry(&self, key_id: &str, expiry: Duration) -> bool {
        let key_ids = self.key_ids.read().await;
        let mut keys = self.keys.write().await;
        
        if let Some(key_hash) = key_ids.get(key_id)
            && let Some(key) = keys.get_mut(key_hash) {
                key.expires_at = Some(key.created_at + expiry);
                return true;
            }
        false
    }

    pub async fn remove_key_expiry(&self, key_id: &str) -> bool {
        let key_ids = self.key_ids.read().await;
        let mut keys = self.keys.write().await;
        
        if let Some(key_hash) = key_ids.get(key_id)
            && let Some(key) = keys.get_mut(key_hash) {
                key.expires_at = None;
                return true;
            }
        false
    }
}

impl Default for ApiKeyStore {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Debug, Clone)]
pub struct ApiKeyInfo {
    pub id: String,
    pub name: String,
    pub created_at: Instant,
    pub expires_at: Option<Instant>,
    pub last_used_at: Option<Instant>,
    pub rate_limit_per_minute: u32,
}

fn hash_key(key: &str) -> String {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    
    let mut hasher = DefaultHasher::new();
    key.hash(&mut hasher);
    format!("{:x}", hasher.finish())
}
