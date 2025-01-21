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
        this.startTimestamp = null;
        this.positionCount = 0; // 新增：位置计数

        this.speedElem = document.getElementById('speed');
        this.accelerationElem = document.getElementById('acceleration');
        this.distanceElem = document.getElementById('distance');
        this.durationElem = document.getElementById('duration');
        this.avgSpeedElem = document.getElementById('avgSpeed');
        
        this.startBtn = document.getElementById('startBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.refreshBtn = document.getElementById('refreshBtn');
        
        this.startBtn.addEventListener('click', () => this.start());
        this.stopBtn.addEventListener('click', () => this.stop());
        this.refreshBtn.addEventListener('click', () => this.refreshPosition());

        this.initMap();
    }

    // ... 其他方法保持不变 ...

    updatePosition(position) {
        const { latitude, longitude, speed, accuracy } = position.coords;
        const timestamp = position.timestamp;
        
        // 使用卡尔曼滤波器平滑位置
        const filteredLat = this.kalmanFilterUpdate(latitude);
        const filteredLng = this.kalmanFilterUpdate(longitude);
        
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
                    strokeColor: "#3366FF",
                    strokeWeight: 6,
                    map: this.map
                });
            } else {
                this.polyline.setPath(this.path);
            }
        }

        // 计算速度和加速度
        let currentSpeed = 0;
        let acceleration = 0;
        let distance = 0;
        
        // 更新位置计数
        this.positionCount++;
        
        // 前5个数据点只更新位置，不计算速度
        if (this.positionCount < 5) {
            // 更新最后记录
            this.lastPosition = position;
            this.lastTimestamp = timestamp;
            return;
        }
        
        if (this.lastPosition && this.lastTimestamp) {
            const timeDiff = (timestamp - this.lastTimestamp) / 1000;
            
            // 忽略时间差过小（小于1秒）或过大（大于10秒）的情况
            if (timeDiff > 1 && timeDiff < 10) {
                distance = this.calculateDistance(
                    this.lastPosition.coords.latitude,
                    this.lastPosition.coords.longitude,
                    latitude,
                    longitude
                );
                
                // 忽略异常距离（大于50米）
                if (distance < 50) {
                    this.totalDistance += distance;
                    
                    // 计算速度，使用加权平均
                    const weight = Math.min(1, Math.max(0, 1 - (accuracy / 50))); // 根据精度计算权重
                    currentSpeed = (distance / timeDiff * weight) + (this.lastSpeed * (1 - weight));
                    
                    // 限制最大速度（10 m/s）
                    if (currentSpeed > 10) {
                        currentSpeed = this.lastSpeed || 0;
                    }
                    
                    // 计算加速度
                    if (this.lastSpeed !== null) {
                        acceleration = (currentSpeed - this.lastSpeed) / timeDiff;
                        
                        // 限制最大加速度（3 m/s²）
                        if (Math.abs(acceleration) > 3) {
                            acceleration = 0;
                        }
                    }
                }
            }
        }
        
        // 更新显示
        this.speedElem.textContent = Math.abs(currentSpeed).toFixed(2);
        this.accelerationElem.textContent = Math.abs(acceleration).toFixed(2);
        this.distanceElem.textContent = (this.totalDistance / 1000).toFixed(2);

        // 检查是否达到运动目标
        if (!this.targetReached && this.totalDistance >= this.targetDistance) {
            this.targetReached = true;
            alert('你太棒了，今天运动目标达成，继续加油哦！');
        }
        
        // 更新最后记录
        this.lastPosition = position;
        this.lastTimestamp = timestamp;
        this.lastSpeed = currentSpeed;

        // 计算运动时间和平均速度
        if (this.startTimestamp) {
            const currentTime = Date.now();
            const duration = (currentTime - this.startTimestamp) / 1000 / 60;
            const avgSpeed = this.totalDistance / 1000 / (duration / 60);
            
            this.durationElem.textContent = duration.toFixed(1);
            this.avgSpeedElem.textContent = avgSpeed.toFixed(1);
        }
    }

    // ... 其他方法保持不变 ...
}

// 初始化跟踪器
document.addEventListener('DOMContentLoaded', () => {
    if (!navigator.geolocation) {
        alert('您的浏览器不支持地理位置功能');
        return;
    }
    
    new LocationTracker();
});
