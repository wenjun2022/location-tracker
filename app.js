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
        
        // 卡尔曼滤波器参数
        this.kalmanFilter = {
            Q: 0.1, // 过程噪声
            R: 5,   // 测量噪声
            P: 1,   // 估计误差协方差
            x: null // 状态估计值
        };

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

    initMap() {
        this.map = new AMap.Map('map', {
            zoom: 15,
            center: [116.397428, 39.90923]
        });
    }

    start() {
        if (this.watchId !== null) return;
        
        // 重置数据
        this.path = [];
        this.totalDistance = 0;
        this.targetReached = false;
        this.distanceElem.textContent = '0.00';
        this.startTimestamp = Date.now();
        
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

    kalmanFilterUpdate(measurement) {
        if (!this.kalmanFilter.x) {
            this.kalmanFilter.x = measurement;
            return measurement;
        }
        
        // 预测
        const x_pred = this.kalmanFilter.x;
        const P_pred = this.kalmanFilter.P + this.kalmanFilter.Q;
        
        // 更新
        const K = P_pred / (P_pred + this.kalmanFilter.R);
        const x_est = x_pred + K * (measurement - x_pred);
        const P_est = (1 - K) * P_pred;
        
        this.kalmanFilter.x = x_est;
        this.kalmanFilter.P = P_est;
        
        return x_est;
    }

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
        let currentSpeed = speed || 0;
        let acceleration = 0;
        let distance = 0;
        
        if (this.lastPosition && this.lastTimestamp) {
            const timeDiff = (timestamp - this.lastTimestamp) / 1000;
            // 忽略时间差过小的情况（小于0.1秒）
            if (timeDiff > 0.1) {
                distance = this.calculateDistance(
                    this.lastPosition.coords.latitude,
                    this.lastPosition.coords.longitude,
                    latitude,
                    longitude
                );
                
                // 忽略异常距离（大于1000米）
                if (distance < 1000) {
                    this.totalDistance += distance;
                    currentSpeed = distance / timeDiff;
                    
                    // 限制最大速度（100 m/s）
                    if (currentSpeed > 100) {
                        currentSpeed = this.lastSpeed || 0;
                    }
                    
                    // 计算加速度
                    if (this.lastSpeed !== null) {
                        acceleration = (currentSpeed - this.lastSpeed) / timeDiff;
                        
                        // 限制最大加速度（10 m/s²）
                        if (Math.abs(acceleration) > 10) {
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

    refreshPosition() {
        if (!this.map) {
            console.error('地图未初始化');
            return;
        }

        navigator.geolocation.getCurrentPosition(
            position => {
                const { latitude, longitude } = position.coords;
                // 使用卡尔曼滤波后的位置
                const filteredLat = this.kalmanFilterUpdate(latitude);
                const filteredLng = this.kalmanFilterUpdate(longitude);
                const gcj02 = this.wgs84ToGcj02(filteredLng, filteredLat);
                
                // 如果标记不存在则创建
                if (!this.marker) {
                    this.marker = new AMap.Marker({
                        position: gcj02,
                        map: this.map
                    });
                } else {
                    // 更新标记位置
                    this.marker.setPosition(gcj02);
                }
                
                // 移动地图中心到当前位置
                this.map.setCenter(gcj02);
                
                // 设置合适的缩放级别
                this.map.setZoom(15);
                
                console.log('位置刷新成功：', gcj02);
            },
            error => {
                console.error('获取位置失败:', error);
                alert('无法获取当前位置，请检查位置权限设置');
            },
            {
                enableHighAccuracy: true,
                maximumAge: 0,
                timeout: 10000
            }
        );
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
        // 保留最后的数据显示
        // 不再清除数据
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
