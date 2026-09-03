const { createMatchings } = require("../src/matching");

test("createMatchings pairs correctly", () => {
	expect(createMatchings(["1", "2", "3", "4"], 2).length).toEqual(2);
	// 5 members with groupSize 2 => 3 groups (2+2+1)
	expect(createMatchings(["1", "2", "3", "4", "5"], 2).length).toEqual(3);
	// single group size 2 for 2 members
	expect(createMatchings(["1", "2"], 2)[0].length).toEqual(2);
});
