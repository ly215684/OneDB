use std::sync::Arc;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;
use tokio::sync::oneshot;

/// Represents a running SSH tunnel.
pub struct SSHTunnel {
    pub local_port: u16,
    shutdown_tx: oneshot::Sender<()>,
}

impl SSHTunnel {
    pub fn shutdown(self) {
        let _ = self.shutdown_tx.send(());
    }
}

/// A no-op client handler required by russh
struct ClientHandler;

#[async_trait::async_trait]
impl russh::client::Handler for ClientHandler {
    type Error = russh::Error;

    async fn check_server_key(
        &mut self,
        _public_key: &[u8],
    ) -> Result<bool, Self::Error> {
        Ok(true) // Accept any server key for desktop client
    }
}

/// Open an SSH tunnel and start a local TCP listener.
/// Returns the local port to connect to.
pub async fn open_tunnel(
    ssh_host: &str,
    ssh_port: u16,
    ssh_user: &str,
    ssh_password: Option<&str>,
    ssh_private_key: Option<&str>,
    remote_host: &str,
    remote_port: u16,
) -> Result<SSHTunnel, String> {
    let config = russh::client::Config {
        inactivity_timeout: Some(std::time::Duration::from_secs(30)),
        ..Default::default()
    };
    let config = Arc::new(config);

    // Connect to SSH server
    let mut session = russh::client::connect(config, (ssh_host, ssh_port), ClientHandler)
        .await
        .map_err(|e| format!("SSH connect failed: {}", e))?;

    // Authenticate
    let mut authenticated = false;

    if let Some(key_data) = ssh_private_key {
        if !key_data.is_empty() {
            let key = russh_keys::decode_secret_key(key_data, None)
                .map_err(|e| format!("SSH key decode error: {}", e))?;
            authenticated = session
                .authenticate_publickey(ssh_user, Arc::new(key))
                .await
                .map_err(|e| format!("SSH pubkey auth error: {}", e))?;
        }
    }

    if !authenticated {
        if let Some(pwd) = ssh_password {
            if !pwd.is_empty() {
                authenticated = session
                    .authenticate_password(ssh_user, pwd)
                    .await
                    .map_err(|e| format!("SSH password auth error: {}", e))?;
            }
        }
    }

    if !authenticated {
        return Err("SSH authentication failed".to_string());
    }

    // Bind local port
    let listener = TcpListener::bind("127.0.0.1:0")
        .await
        .map_err(|e| format!("Bind local port failed: {}", e))?;
    let local_port = listener.local_addr().unwrap().port();

    let (shutdown_tx, mut shutdown_rx) = oneshot::channel::<()>();
    let rh = remote_host.to_string();

    // Accept loop: forward each TCP connection through SSH
    tokio::spawn(async move {
        loop {
            tokio::select! {
                result = listener.accept() => {
                    match result {
                        Ok((tcp_stream, _)) => {
                            let sess = session.clone();
                            let host = rh.clone();
                            let port = remote_port;
                            tokio::spawn(async move {
                                if let Err(e) = forward_connection(tcp_stream, sess, &host, port).await {
                                    eprintln!("SSH forward error: {}", e);
                                }
                            });
                        }
                        Err(_) => break,
                    }
                }
                _ = &mut shutdown_rx => break,
            }
        }
    });

    Ok(SSHTunnel { local_port, shutdown_tx })
}

/// Forward a single TCP connection through an SSH channel to the remote host.
async fn forward_connection(
    mut tcp: tokio::net::TcpStream,
    session: Arc<russh::Handle>,
    remote_host: &str,
    remote_port: u16,
) -> Result<(), String> {
    // Open a direct-tcpip channel through SSH
    let mut channel = session
        .channel_open_direct_tcpip(remote_host, remote_port, "127.0.0.1", 0)
        .await
        .map_err(|e| format!("Channel open failed: {}", e))?;

    let mut buf_tcp = vec![0u8; 16384];

    // Bidirectional copy using tokio::select!
    loop {
        tokio::select! {
            // TCP → SSH
            result = tcp.read(&mut buf_tcp) => {
                match result {
                    Ok(0) => break, // EOF
                    Ok(n) => {
                        channel.data(&buf_tcp[..n]).await
                            .map_err(|e| format!("Channel write error: {}", e))?;
                    }
                    Err(_) => break,
                }
            }
            // SSH → TCP
            msg = channel.wait() => {
                match msg {
                    Some(russh::ChannelMsg::Data { ref data }) => {
                        if tcp.write_all(data).await.is_err() { break; }
                    }
                    Some(russh::ChannelMsg::Eof) | Some(russh::ChannelMsg::Close) => break,
                    None => break,
                    _ => {} // Ignore other channel messages
                }
            }
        }
    }

    let _ = channel.close().await;
    Ok(())
}
