/**
 * Checks if a point [lat, lon] is inside a polygon [[lat, lon], ...]
 * Using the Ray-Casting algorithm.
 */
export const isPointInPolygon = (point, polygon) => {
    if (!polygon || polygon.length < 3) return true; // No polygon or invalid, consider inside

    const x = point[0];
    const y = point[1];
    let inside = false;

    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i][0];
        const yi = polygon[i][1];
        const xj = polygon[j][0];
        const yj = polygon[j][1];

        const intersect = ((yi > y) !== (yj > y)) &&
            (x < (xj - xi) * (y - yi) / (yj - yi) + xi);

        if (intersect) inside = !inside;
    }

    return inside;
};
