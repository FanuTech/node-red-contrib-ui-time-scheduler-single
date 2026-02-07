/*
MIT License
Copyright (c) 2020 Mario Fellinger
(Modified for per-device TZ and Single Schedule)
*/

module.exports = function(RED) {
    'use strict';

    function HTML(config) {
        var uniqueId = config.id.replace(".", "");
        var divPrimary = "ui-ts-" + uniqueId;

        // Common timezones
        var timezones = [
            "UTC", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
            "America/Phoenix", "America/Anchorage", "America/Honolulu", "Europe/London",
            "Europe/Paris", "Europe/Berlin", "Europe/Moscow", "Asia/Dubai", "Asia/Kolkata",
            "Asia/Bangkok", "Asia/Shanghai", "Asia/Tokyo", "Australia/Sydney", "Australia/Perth",
            "Pacific/Auckland"
        ];

        // CSS Styles
        var style = "<style>" +
            "#" + divPrimary + " { padding: 0; }" +
            "#" + divPrimary + " .device-row { display: flex; align-items: center; justify-content: space-between; padding: 10px; border-bottom: 1px solid var(--nr-dashboard-groupBorderColor); }" +
            "#" + divPrimary + " .device-info { display: flex; flex-direction: column; }" +
            "#" + divPrimary + " .device-name { font-weight: bold; font-size: 1.1em; color: var(--nr-dashboard-widgetTextColor); }" +
            "#" + divPrimary + " .device-meta { font-size: 0.85em; opacity: 0.7; color: var(--nr-dashboard-widgetTextColor); }" +
            "#" + divPrimary + "-edit { display: none; padding: 10px; background: var(--nr-dashboard-widgetColor); }" +
            "#" + divPrimary + " md-input-container { width: 100%; margin: 5px 0; }" +
            "#" + divPrimary + " .btn-group { display: flex; justify-content: flex-end; margin-top: 10px; }" +
            "</style>";

        // HTML Layout
        // Note: We escape single quotes in the config string to prevent HTML breakage
        var configStr = JSON.stringify(config).replace(/'/g, "&#39;");
        var tzStr = JSON.stringify(timezones).replace(/'/g, "&#39;");

        var layout = "<div id='" + divPrimary + "' ng-init='init(" + configStr + ", " + tzStr + ")'>" +
            
            // MAIN LIST VIEW
            "<div id='view-list-" + uniqueId + "'>" +
                "<div class='device-row' ng-repeat='device in devices track by $index'>" +
                    "<div class='device-info'>" +
                        "<span class='device-name'>{{device}}</span>" +
                        "<span class='device-meta'>" +
                            "<span ng-if='getDeviceSchedule($index)'>" +
                                "{{getDeviceSchedule($index).summary}}<br>" +
                                "<small>Zone: {{getDeviceTimezone($index)}}</small>" +
                            "</span>" +
                            "<span ng-if='!getDeviceSchedule($index)'>No Schedule</span>" +
                        "</span>" +
                    "</div>" +
                    "<md-button class='md-icon-button' ng-click='editDevice($index)'>" +
                        "<md-icon>edit</md-icon>" +
                    "</md-button>" +
                "</div>" +
            "</div>" +

            // EDIT VIEW
            "<div id='view-edit-" + uniqueId + "' style='display:none;'>" +
                "<h4 style='margin-top:0; color:var(--nr-dashboard-widgetTextColor)'>Edit: {{editingDeviceName}}</h4>" +
                "<form ng-submit='saveDevice()'>" +
                    
                    // Timezone
                    "<md-input-container>" +
                        "<label>Timezone</label>" +
                        "<md-select ng-model='editor.timezone'>" +
                            "<md-option ng-repeat='tz in availableTimezones' value='{{tz}}'>{{tz}}</md-option>" +
                        "</md-select>" +
                    "</md-input-container>" +

                    // Time Inputs
                    "<div layout='row' layout-align='space-between center'>" +
                        "<md-input-container flex='45'>" +
                            "<label>Start Time</label>" +
                            "<input type='time' ng-model='editor.startTimeStr' required>" +
                        "</md-input-container>" +
                        "<md-input-container flex='45'>" +
                            "<label>End Time</label>" +
                            "<input type='time' ng-model='editor.endTimeStr' required>" +
                        "</md-input-container>" +
                    "</div>" +

                    // Day Buttons
                    "<div layout='row' layout-wrap style='margin-bottom: 15px;'>" +
                        "<div flex='100' style='color:var(--nr-dashboard-widgetTextColor); margin-bottom:5px;'>Active Days</div>" +
                        "<md-button ng-repeat='day in days' class='md-icon-button' " +
                        "style='margin:0; width:35px; background-color: {{editor.days[$index] ? \"var(--nr-dashboard-widgetColor)\" : \"transparent\"}}; border: 1px solid var(--nr-dashboard-groupBorderColor); opacity: {{editor.days[$index] ? 1 : 0.4}}' " +
                        "ng-click='toggleDay($index)'>" +
                            "{{day.substring(0,1)}}" +
                        "</md-button>" +
                    "</div>" +

                    // Actions
                    "<div class='btn-group'>" +
                        "<md-button ng-click='cancelEdit()'>Cancel</md-button>" +
                        "<md-button class='md-raised md-primary' type='submit'>Save</md-button>" +
                        "<md-button class='md-raised md-warn' ng-click='clearSchedule()' type='button' style='margin-left:10px;'>Clear</md-button>" +
                    "</div>" +
                "</form>" +
            "</div>" +
        "</div>";

        return style + layout;
    }

    function checkConfig(config, node) {
        if (!config) {
            node.error("No config");
            return false;
        }
        if (!config.hasOwnProperty("group")) {
            node.error("No group");
            return false;
        }
        return true;
    }

    function TimeSchedulerNode(config) {
        try {
            var ui = undefined;
            if (ui === undefined) {
                try {
                    ui = RED.require("node-red-dashboard")(RED);
                } catch(e) {
                    console.warn("node-red-dashboard not found");
                }
            }

            RED.nodes.createNode(this, config);
            var node = this;

            if (!config.hasOwnProperty("refresh")) config.refresh = 60;
            if (!config.hasOwnProperty("devices") || config.devices.length === 0) config.devices = [config.name];
            
            // Try to load i18n, fallback if missing
            try {
                config.i18n = RED._("time-scheduler.ui", { returnObjects: true });
            } catch(e) {
                config.i18n = {}; 
            }

            if (checkConfig(config, node) && ui) {
                var done = ui.addWidget({
                    node: node,
                    format: HTML(config),
                    templateScope: "local",
                    group: config.group,
                    width: config.width,
                    height: config.height,
                    order: config.order,
                    emitOnlyNewValues: false,
                    forwardInputMessages: false,
                    storeFrontEndInputAsState: true,
                    persistantFrontEndValue: true,
                    beforeEmit: function(msg, value) {
                        if (msg.hasOwnProperty("getStatus")) {
                            msg.payload = serializeData();
                            node.send(msg);
                            return msg;
                        } else {
                            try {
                                var parsedInput = JSON.parse(value);
                                if (parsedInput.timers) setTimers(parsedInput.timers);
                                if (parsedInput.settings) setSettings(parsedInput.settings);
                                node.status({ fill: "green", shape: "dot", text: "Updated" });
                            } catch (e) {
                                node.error(e);
                            }
                        }
                        return { msg: [msg] };
                    },
                    initController: function($scope) {
                        $scope.init = function(config, timezones) {
                            $scope.nodeId = config.id;
                            $scope.days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
                            $scope.devices = config.devices;
                            $scope.availableTimezones = timezones;
                            $scope.timers = [];
                            $scope.settings = { timezones: {} };
                            $scope.getDataFromServer();
                        };

                        $scope.getDeviceSchedule = function(index) {
                            var t = $scope.timers.find(function(x) { return x.output == index; });
                            if (!t) return null;
                            
                            var start = new Date(t.starttime);
                            var end = new Date(t.endtime);
                            var startStr = $scope.pad(start.getHours()) + ":" + $scope.pad(start.getMinutes());
                            var endStr = $scope.pad(end.getHours()) + ":" + $scope.pad(end.getMinutes());
                            
                            var dayStr = "";
                            var allDays = true;
                            for(var i=0; i<7; i++) {
                                if(t.days[i]) dayStr += $scope.days[i].substring(0,1) + " ";
                                else allDays = false;
                            }
                            if(allDays) dayStr = "Everyday";

                            return { summary: startStr + " - " + endStr + " (" + dayStr + ")" };
                        };

                        $scope.getDeviceTimezone = function(index) {
                            if ($scope.settings && $scope.settings.timezones && $scope.settings.timezones[index]) {
                                return $scope.settings.timezones[index];
                            }
                            return "UTC";
                        };

                        $scope.pad = function(n) { return n < 10 ? '0'+n : n; };

                        $scope.editDevice = function(index) {
                            $scope.activeDeviceIndex = index;
                            $scope.editingDeviceName = $scope.devices[index];

                            $scope.editor = {
                                timezone: $scope.getDeviceTimezone(index),
                                days: [0,0,0,0,0,0,0],
                                startTimeStr: "08:00",
                                endTimeStr: "17:00"
                            };

                            var t = $scope.timers.find(function(x) { return x.output == index; });
                            if (t) {
                                $scope.editor.days = t.days;
                                var sDate = new Date(t.starttime);
                                var eDate = new Date(t.endtime);
                                $scope.editor.startTimeStr = $scope.formatTimeInput(sDate);
                                $scope.editor.endTimeStr = $scope.formatTimeInput(eDate);
                            } else {
                                $scope.editor.days = [0,1,1,1,1,1,0]; 
                            }

                            document.getElementById("view-list-" + $scope.nodeId.replace(".","")).style.display = "none";
                            document.getElementById("view-edit-" + $scope.nodeId.replace(".","")).style.display = "block";
                        };

                        $scope.cancelEdit = function() {
                            document.getElementById("view-edit-" + $scope.nodeId.replace(".","")).style.display = "none";
                            document.getElementById("view-list-" + $scope.nodeId.replace(".","")).style.display = "block";
                        };

                        $scope.toggleDay = function(dayIndex) {
                            $scope.editor.days[dayIndex] = $scope.editor.days[dayIndex] ? 0 : 1;
                        };

                        $scope.saveDevice = function() {
                            var idx = $scope.activeDeviceIndex;
                            if (!$scope.settings.timezones) $scope.settings.timezones = {};
                            $scope.settings.timezones[idx] = $scope.editor.timezone;

                            var sParts = $scope.editor.startTimeStr.split(":");
                            var eParts = $scope.editor.endTimeStr.split(":");
                            var startDate = new Date(0,0,0, sParts[0], sParts[1]);
                            var endDate = new Date(0,0,0, eParts[0], eParts[1]);

                            var newTimer = {
                                output: idx,
                                starttime: startDate.getTime(),
                                endtime: endDate.getTime(),
                                days: $scope.editor.days
                            };

                            $scope.timers = $scope.timers.filter(function(t) { return t.output != idx; });
                            $scope.timers.push(newTimer);

                            $scope.sendData();
                            $scope.cancelEdit();
                        };

                        $scope.clearSchedule = function() {
                            var idx = $scope.activeDeviceIndex;
                            $scope.timers = $scope.timers.filter(function(t) { return t.output != idx; });
                            
                            if (!$scope.settings.timezones) $scope.settings.timezones = {};
                            $scope.settings.timezones[idx] = $scope.editor.timezone;

                            $scope.sendData();
                            $scope.cancelEdit();
                        };

                        $scope.formatTimeInput = function(dateObj) {
                            return $scope.pad(dateObj.getHours()) + ":" + $scope.pad(dateObj.getMinutes());
                        };

                        $scope.sendData = function() {
                            var payload = {
                                timers: angular.copy($scope.timers),
                                settings: angular.copy($scope.settings)
                            };
                            $scope.send({ payload: payload });
                        };

                        $scope.getDataFromServer = function() {
                            $.ajax({
                                url: "time-scheduler/getNode/" + $scope.nodeId, dataType: 'json',
                                success: function(json) {
                                    $scope.timers = json.timers || [];
                                    $scope.settings = json.settings || { timezones: {} };
                                    $scope.$digest();
                                }
                            });
                        };
                    }
                });

                var nodeInterval;

                // Init Helper
                function init() {
                    var timers = getContextValue('timers') || [];
                    var settings = getContextValue('settings') || { timezones: {} };
                    setTimers(timers);
                    setSettings(settings);
                    
                    var today = new Date();
                    var remaining = 60 - today.getSeconds(); 
                    setTimeout(function() {
                        nodeInterval = setInterval(intervalTimerFunction, 60000);
                        intervalTimerFunction();
                    }, remaining * 1000);
                }
                init();

                function getContextValue(key) {
                    return config.customContextStore && RED.settings.contextStorage && RED.settings.contextStorage.hasOwnProperty(config.customContextStore) ?
                        node.context().get(key, config.customContextStore) : node.context().get(key);
                }

                function setContextValue(key, value) {
                    config.customContextStore && RED.settings.contextStorage && RED.settings.contextStorage.hasOwnProperty(config.customContextStore) ?
                        node.context().set(key, value, config.customContextStore) : node.context().set(key, value);
                }

                function setTimers(t) { setContextValue('timers', t); }
                function getTimers() { return getContextValue('timers') || []; }
                function setSettings(s) { setContextValue('settings', s); }
                function getSettings() { return getContextValue('settings') || { timezones: {} }; }
                
                function serializeData() {
                    return JSON.stringify({ timers: getTimers(), settings: getSettings() });
                }

                function intervalTimerFunction() {
                    var outputValues = [null];
                    for (var i = 0; i < config.devices.length; i++) {
                        var isOn = isDeviceActive(i);
                        var msg = { payload: isOn, topic: config.devices[i] };
                        outputValues.push(msg);
                    }
                    node.send(outputValues);
                }

                function isDeviceActive(deviceIndex) {
                    var timers = getTimers();
                    var settings = getSettings();
                    
                    var timer = timers.find(function(t) { return t.output == deviceIndex; });
                    if (!timer) return false;

                    var tz = (settings.timezones && settings.timezones[deviceIndex]) ? settings.timezones[deviceIndex] : "UTC";
                    var nowServer = new Date();
                    var deviceTimeStr;
                    try {
                        deviceTimeStr = nowServer.toLocaleString("en-US", { timeZone: tz, hour12: false });
                    } catch(e) {
                        deviceTimeStr = nowServer.toLocaleString("en-US", { timeZone: "UTC", hour12: false });
                    }
                    
                    var deviceDate = new Date(deviceTimeStr);
                    var currentDay = deviceDate.getDay(); 
                    var currentHour = deviceDate.getHours();
                    var currentMin = deviceDate.getMinutes();
                    var currentTimeVal = (currentHour * 60) + currentMin;

                    if (!timer.days[currentDay]) return false;

                    var tStart = new Date(timer.starttime);
                    var tEnd = new Date(timer.endtime);
                    var startVal = (tStart.getHours() * 60) + tStart.getMinutes();
                    var endVal = (tEnd.getHours() * 60) + tEnd.getMinutes();

                    if (startVal < endVal) {
                        return currentTimeVal >= startVal && currentTimeVal < endVal;
                    } else {
                        return currentTimeVal >= startVal || currentTimeVal < endVal;
                    }
                }

                function getNodeData() {
                    return { timers: getTimers(), settings: getSettings() };
                }

                node.nodeCallback = function nodeCallback(req, res) {
                    res.send(getNodeData());
                };

                node.on("close", function() {
                    if (nodeInterval) clearInterval(nodeInterval);
                });
            }
        } catch (error) {
            console.log("TimeSchedulerNode:", error);
        }
    }
    RED.nodes.registerType("ui_time_scheduler", TimeSchedulerNode);

    var uiPath = ((RED.settings.ui || {}).path);
    if (uiPath == undefined) uiPath = 'ui';
    var nodePath = '/' + uiPath + '/time-scheduler/getNode/:nodeId';
    nodePath = nodePath.replace(/\/+/g, '/');

    RED.httpNode.get(nodePath, function(req, res) {
        var nodeId = req.params.nodeId;
        var node = RED.nodes.getNode(nodeId);
        node ? node.nodeCallback(req, res) : res.send(404).end();
    });
};