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
        this.startTimestamp = null; // 初始化运动开始时间

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

        // 初始化地图
        this.initMap();
    }

    initMap() {
        this.map = new AMap.Map('map', {
            zoom: 15,
            center: [116.397428, 39.90923] // 默认中心点
        });
    }

    refreshPosition() {
        if (!this.map) {
            console.error('地图未初始化');
            return;
        }

        navigator.geolocation.getCurrentPosition(
            position => {
                const { latitude, longitude } = position.coords;
                const gcj02 = this.wgs84ToGcj02(longitude, latitude);
                
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

    // ... 保留其他方法不变 ...
}

// 初始化跟踪器
document.addEventListener('DOMContentLoaded', () => {
    if (!navigator.geolocation) {
        alert('您的浏览器不支持地理位置功能');
        return;
    }
    
    new LocationTracker();
});
