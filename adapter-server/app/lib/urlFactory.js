let protooPort = 4443;

// if (window.location.hostname === 'test.mediasoup.org')
// 	protooPort = 4444;

export function getProtooUrl({ roomId, peerId, consumerReplicas }) {
	// const hostname = window.location.hostname;
	const hostname = '15.165.78.81';

	return `wss://${hostname}:${protooPort}/?roomId=${roomId}&peerId=${peerId}&consumerReplicas=${consumerReplicas}`;
}
