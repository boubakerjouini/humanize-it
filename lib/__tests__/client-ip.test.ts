import { ipBucket } from "@/lib/client-ip";

describe("ipBucket", () => {
  it("keeps IPv4 addresses (and IPv4-mapped IPv6) as they are", () => {
    expect(ipBucket("203.0.113.7")).toBe("203.0.113.7");
    expect(ipBucket("::ffff:203.0.113.7")).toBe("203.0.113.7");
    expect(ipBucket("unknown")).toBe("unknown");
  });

  it("puts every address of one IPv6 /64 in the same bucket", () => {
    const a = ipBucket("2001:db8:abcd:12::1");
    expect(a).toBe("2001:db8:abcd:12::/64");
    expect(ipBucket("2001:0db8:abcd:0012:ffff:1:2:3")).toBe(a);
    expect(ipBucket("2001:db8:abcd:13::1")).not.toBe(a);
    expect(ipBucket("2001:db8::1")).toBe("2001:db8:0:0::/64");
    expect(ipBucket("fe80::1%eth0")).toBe("fe80:0:0:0::/64");
  });
});
