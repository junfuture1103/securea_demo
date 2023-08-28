#!/bin/bash

echo "RUN VPN Setting"

openvpn --config /usr/src/webrtc.ovpn &

node signaling.js