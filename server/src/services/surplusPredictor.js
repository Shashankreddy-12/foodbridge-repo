import FoodListing from '../models/FoodListing.js';

export const getHourlyForecast = async () => {
    try {
        // Use MongoDB aggregation to group all FoodListing documents by hour-of-day
        const aggResult = await FoodListing.aggregate([
            {
                $group: {
                    _id: { $hour: "$createdAt" },
                    count: { $sum: 1 }
                }
            }
        ]);

        const countsMap = {};
        aggResult.forEach(item => {
            countsMap[item._id] = item.count;
        });

        const forecast = [];
        
        for (let hour = 0; hour < 24; hour++) {
            const period = hour < 12 ? 'AM' : 'PM';
            const displayHour = hour === 0 ? 12 : (hour > 12 ? hour - 12 : hour);
            const label = `${displayHour}:00 ${period}`;
            const count = countsMap[hour] || 0;
            
            forecast.push({
                hour,
                label,
                predicted: parseFloat(count.toFixed(1)), // historical average logic simplified to raw count map
                isPeak: false
            });
        }

        // Only find peak if there is > 0 data
        const hasData = forecast.some(f => f.predicted > 0);
        if (hasData) {
            // Sort to find top 3
            const sorted = [...forecast].sort((a, b) => b.predicted - a.predicted);
            const top3 = sorted.slice(0, 3).filter(s => s.predicted > 0); // only if actually active
            
            top3.forEach(t => {
                const target = forecast.find(f => f.hour === t.hour);
                if (target) target.isPeak = true;
            });
        }

        return forecast;
    } catch (err) {
        throw err;
    }
};

export const getPeakHours = async () => {
    try {
        const forecast = await getHourlyForecast();
        return forecast.filter(f => f.isPeak).map(f => ({
            hour: f.hour,
            label: f.label,
            predicted: f.predicted
        }));
    } catch (err) {
        throw err;
    }
};
