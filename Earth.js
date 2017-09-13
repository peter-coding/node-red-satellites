module.exports = function (RED) {
	"use strict";
	var express = require("express");
	var path = require("path");
	var io = require('socket.io');
	var socket;

	function EarthNode(config) {
		RED.nodes.createNode(this, config);
		var node = this;

		if (!socket) {
			var fullPath = path.join(RED.settings.httpNodeRoot, 'earth', 'socket.io');
			socket = io.listen(RED.server, {
				path: fullPath
			});
		}
		
		RED.httpNode.use('/earth', express.static(__dirname + '/satellites'));

		var onConnection = function (client) {
			client.setMaxListeners(0);
			node.status({
				fill: "green",
				shape: "dot",
				text: "connected " + socket.engine.clientsCount
			});

			function emit(msg) {
				client.emit("earthdata", msg.payload);
			}

			node.on('input', emit);

			client.on('disconnect', function () {
				node.removeListener("input", emit);
				node.status({
					fill: "green",
					shape: "ring",
					text: "connected " + socket.engine.clientsCount
				});
			});

			node.on('close', function () {
				node.status({});
				client.disconnect(true);
			});
		};
		node.status({});
		socket.on('connection', onConnection);
	}
	RED.nodes.registerType("earth", EarthNode);
};
