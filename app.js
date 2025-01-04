class LocationTracker {
    constructor() {
        this.watchId = null;
        this.lastPosition = null;
        this.lastTimestamp = null;
        this.lastSpeed = 0;
        this.map = null;
        this.marker = null;
        this.polyline = null;
        this.path = [];
        this.totalDistance = 0;
        this.targetDistance = 2000; // 2公里目标（单位：米）
        this.targetReached = false;

        this.speedElem = document.getElementById('speed');
        this.accelerationElem = document.getElementById('acceleration');
        this.distanceElem = document.getElementById('distance');
        this.durationElem = document.getElementById('duration');
        this.avgSpeedElem = document.getElementById('avgSpeed');
        
        this.startBtn = document.getElementById('startBtn');
        this.stopBtn = document.getElementById('stopBtn');
        
        this.startBtn.addEventListener('click', () => this.start());
        this.stopBtn.addEventListener('click', () => this.stop());

        // 初始化地图
        this.initMap();
    }

    initMap() {
        this.map = new AMap.Map('map', {
            zoom: 15,
            center: [116.397428, 39.90923] // 默认中心点
        });
    }

    start() {
        if (this.watchId !== null) return;
        
        // 重置数据
        this.path = [];
        this.totalDistance = 0;
        this.targetReached = false;
        this.distanceElem.textContent = '0.00';
        if (this.polyline) {
            this.map.remove(this.polyline);
            this.polyline = null;
        }
        
        this.startBtn.disabled = true;
        this.stopBtn.disabled = false;
        
        this.watchId = navigator.geolocation.watchPosition(
            position => this.updatePosition(position),
            error => this.handleError(error),
            {
                enableHighAccuracy: true,
                maximumAge: 0,
                timeout: 5000
            }
        );
    }

    stop() {
        if (this.watchId === null) return;
        
        navigator.geolocation.clearWatch(this.watchId);
        this.watchId = null;
        
        this.startBtn.disabled = false;
        this.stopBtn.disabled = true;
        
        this.resetDisplay();
    }

    updatePosition(position) {
        const { latitude, longitude, speed } = position.coords;
        const timestamp = position.timestamp;
        
        // 将WGS84坐标转换为GCJ02坐标
        const gcj02 = this.wgs84ToGcj02(longitude, latitude);
        
        // 更新地图位置
        if (!this.marker) {
            this.marker = new AMap.Marker({
                position: gcj02,
                map: this.map
            });
        } else {
            this.marker.setPosition(gcj02);
        }
        this.map.setCenter(gcj02);

        // 更新轨迹
        this.path.push(gcj02);
        if (this.path.length > 1) {
            if (!this.polyline) {
                this.polyline = new AMap.Polyline({
                    path: this.path,
                    isOutline: true,
                    outlineColor: '#ffeeff',
                    borderWeight: 1,
                    strokeColor: "#3366FF", 
                    strokeOpacity: 1,
                    strokeWeight: 6,
                    strokeStyle: "solid",
                    lineJoin: 'round',
                    lineCap: 'round',
                    zIndex: 50,
                });
                this.map.add(this.polyline);
            } else {
                this.polyline.setPath(this.path);
            }
        }

        // 计算速度和加速度
        let currentSpeed = speed;
        let acceleration = 0;
        let distance = 0;
        
        if (this.lastPosition && this.lastTimestamp) {
            const timeDiff = (timestamp - this.lastTimestamp) / 1000; // 转换为秒
            distance = this.calculateDistance(
                this.lastPosition.coords.latitude,
                this.lastPosition.coords.longitude,
                latitude,
                longitude
            );
            this.totalDistance += distance;
            
            currentSpeed = distance / timeDiff;
            acceleration = (currentSpeed - this.lastSpeed) / timeDiff;
        }
        
        this.speedElem.textContent = currentSpeed ? currentSpeed.toFixed(2) : '0.00';
        this.accelerationElem.textContent = acceleration ? acceleration.toFixed(2) : '0.00';
        this.distanceElem.textContent = (this.totalDistance / 1000).toFixed(2); // 转换为公里

        // 检查是否达到运动目标
        if (!this.targetReached && this.totalDistance >= this.targetDistance) {
            this.targetReached = true;
            alert('你太棒了，今天运动目标达成，继续加油哦！');
        }
        
        // 计算运动时间和平均速度
        const duration = (timestamp - this.startTimestamp) / 1000 / 60; // 转换为分钟
        const avgSpeed = this.totalDistance / 1000 / (duration / 60); // 转换为km/h
        
        // 更新显示
        this.durationElem.textContent = duration.toFixed(1);
        this.avgSpeedElem.textContent = avgSpeed.toFixed(1);
        
        // 更新最后记录
        this.lastPosition = position;
        this.lastTimestamp = timestamp;
        this.lastSpeed = currentSpeed;
    }

    // WGS84转GCJ02坐标转换
    wgs84ToGcj02(lng, lat) {
        const a = 6378245.0;
        const ee = 0.00669342162296594323;
        
        if (this.outOfChina(lng, lat)) {
            return [lng, lat];
        }
        
        let dlat = this.transformLat(lng - 105.0, lat - 35.0);
        let dlng = this.transformLng(lng - 105.0, lat - 35.0);
        const radlat = lat / 180.0 * Math.PI;
        let magic = Math.sin(radlat);
        magic = 1 - ee * magic * magic;
        const sqrtmagic = Math.sqrt(magic);
        dlat = (dlat * 180.0) / ((a * (1 - ee)) / (magic * sqrtmagic) * Math.PI);
        dlng = (dlng * 180.0) / (a / sqrtmagic * Math.cos(radlat) * Math.PI);
        
        return [lng + dlng, lat + dlat];
    }

    outOfChina(lng, lat) {
        return lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271;
    }

    transformLat(x, y) {
        let ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
        ret += (20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0 / 3.0;
        ret += (20.0 * Math.sin(y * Math.PI) + 40.0 * Math.sin(y / 3.0 * Math.PI)) * 2.0 / 3.0;
        ret += (160.0 * Math.sin(y / 12.0 * Math.PI) + 320 * Math.sin(y * Math.PI / 30.0)) * 2.0 / 3.0;
        return ret;
    }

    transformLng(x, y) {
        let ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
        ret += (20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0 / 3.0;
        ret += (20.0 * Math.sin(x * Math.PI) + 40.0 * Math.sin(x / 3.0 * Math.PI)) * 2.0 / 3.0;
        ret += (150.0 * Math.sin(x / 12.0 * Math.PI) + 300.0 * Math.sin(x / 30.0 * Math.PI)) * 2.0 / 3.0;
        return ret;
    }

    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371e3; // 地球半径（米）
        const φ1 = lat1 * Math.PI/180;
        const φ2 = lat2 * Math.PI/180;
        const Δφ = (lat2-lat1) * Math.PI/180;
        const Δλ = (lon2-lon1) * Math.PI/180;

        const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                  Math.cos(φ1) * Math.cos(φ2) *
                  Math.sin(Δλ/2) * Math.sin(Δλ/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

        return R * c;
    }

    handleError(error) {
        console.error('位置获取错误:', error);
        alert(`位置获取错误: ${error.message}`);
        this.stop();
    }

    resetDisplay() {
        this.speedElem.textContent = '-';
        this.accelerationElem.textContent = '-';
        this.distanceElem.textContent = '-';
        this.durationElem.textContent = '-';
        this.avgSpeedElem.textContent = '-';
    }
}

// 初始化跟踪器
document.addEventListener('DOMContentLoaded', () => {
    if (!navigator.geolocation) {
        alert('您的浏览器不支持地理位置功能');
        return;
    }
    
    new LocationTracker();
});
