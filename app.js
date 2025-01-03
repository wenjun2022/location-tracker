class LocationTracker {
    constructor() {
        this.watchId = null;
        this.lastPosition = null;
        this.lastTimestamp = null;
        this.lastSpeed = 0;
        this.map = null;
        this.marker = null;

        this.latitudeElem = document.getElementById('latitude');
        this.longitudeElem = document.getElementById('longitude');
        this.speedElem = document.getElementById('speed');
        this.accelerationElem = document.getElementById('acceleration');
        
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
        
        // 更新位置显示
        this.latitudeElem.textContent = latitude.toFixed(6);
        this.longitudeElem.textContent = longitude.toFixed(6);
        
        // 更新地图位置
        const lnglat = [longitude, latitude];
        if (!this.marker) {
            this.marker = new AMap.Marker({
                position: lnglat,
                map: this.map
            });
        } else {
            this.marker.setPosition(lnglat);
        }
        this.map.setCenter(lnglat);

        // 计算速度和加速度
        let currentSpeed = speed;
        let acceleration = 0;
        
        if (this.lastPosition && this.lastTimestamp) {
            const timeDiff = (timestamp - this.lastTimestamp) / 1000; // 转换为秒
            const distance = this.calculateDistance(
                this.lastPosition.coords.latitude,
                this.lastPosition.coords.longitude,
                latitude,
                longitude
            );
            
            currentSpeed = distance / timeDiff;
            acceleration = (currentSpeed - this.lastSpeed) / timeDiff;
        }
        
        this.speedElem.textContent = currentSpeed ? currentSpeed.toFixed(2) : '0.00';
        this.accelerationElem.textContent = acceleration ? acceleration.toFixed(2) : '0.00';
        
        // 更新最后记录
        this.lastPosition = position;
        this.lastTimestamp = timestamp;
        this.lastSpeed = currentSpeed;
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
        this.latitudeElem.textContent = '-';
        this.longitudeElem.textContent = '-';
        this.speedElem.textContent = '-';
        this.accelerationElem.textContent = '-';
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
