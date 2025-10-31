import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";

interface TenantConfig {
  subdomain: string;
  databaseUrl: string;
  storeName: string;
  isActive: boolean;
}

class TenantManager {
  private tenants: Map<string, TenantConfig> = new Map();
  private dbConnections: Map<string, any> = new Map();

  constructor() {
    this.loadTenants();
  }

  private loadTenants() {
    // Load tenant configurations from environment or main database
    const tenantsConfig = [
      {
        subdomain: "demo",
        databaseUrl: process.env.EXTERNAL_DB_URL || process.env.DATABASE_URL!,
        storeName: "Store 0 - Cửa hàng demo",
        isActive: true,
      },
      {
        subdomain: "0318225421",
        databaseUrl: process.env.EXTERNAL_DB_URL || process.env.DATABASE_URL!,
        storeName: "Store 1 - Cửa hàng 0318225421",
        isActive: true,
      },
      {
        subdomain: "0111156080",
        databaseUrl:
          process.env.DATABASE_0111156080 ||
          process.env.EXTERNAL_DB_0111156080 ||
          process.env.DATABASE_URL!,
        storeName: "Store 2 - Cửa hàng 0111156080",
        isActive: true,
      },
      {
        subdomain: "hazkitchen",
        databaseUrl:
          process.env.DATABASE_hazkitchen ||
          process.env.EXTERNAL_DB_hazkitchen!,
        storeName: "Store 3 - Cửa hàng hazkitchen",
        isActive: true,
      },
      {
        subdomain: "0108670987-001",
        databaseUrl:
          process.env.DATABASE_0108670987 ||
          process.env.EXTERNAL_DB_0108670987!,
        storeName: "Store 5 - Cửa hàng 0108670987-001",
        isActive: true,
      },
      {
        subdomain: "0108670987-002",
        databaseUrl:
          process.env.DATABASE_0108670987 ||
          process.env.EXTERNAL_DB_0108670987!,
        storeName: "Store 5 - Cửa hàng 0108670987-002",
        isActive: true,
      },
      {
        subdomain: "0108670987-003",
        databaseUrl:
          process.env.DATABASE_0108670987 ||
          process.env.EXTERNAL_DB_0108670987!,
        storeName: "Store 5 - Cửa hàng 0108670987-003",
        isActive: true,
      },
      {
        subdomain: "0108670987-004",
        databaseUrl:
          process.env.DATABASE_0108670987 ||
          process.env.EXTERNAL_DB_0108670987!,
        storeName: "Store 5 - Cửa hàng 0108670987-004",
        isActive: true,
      },
      {
        subdomain: "0108670987-005",
        databaseUrl:
          process.env.DATABASE_0108670987 ||
          process.env.EXTERNAL_DB_0108670987!,
        storeName: "Store 5 - Cửa hàng 0108670987-005",
        isActive: true,
      },
      {
        subdomain: "0108670987-006",
        databaseUrl:
          process.env.DATABASE_0108670987 ||
          process.env.EXTERNAL_DB_0108670987!,
        storeName: "Store 5 - Cửa hàng 0108670987-006",
        isActive: true,
      },
      {
        subdomain: "0108670987-007",
        databaseUrl:
          process.env.DATABASE_0108670987 ||
          process.env.EXTERNAL_DB_0108670987!,
        storeName: "Store 5 - Cửa hàng 0108670987-007",
        isActive: true,
      },
      {
        subdomain: "0108670987-008",
        databaseUrl:
          process.env.DATABASE_0108670987 ||
          process.env.EXTERNAL_DB_0108670987!,
        storeName: "Store 5 - Cửa hàng 0108670987-008",
        isActive: true,
      },
      // Add more tenants as needed
    ];

    tenantsConfig.forEach((config) => {
      this.tenants.set(config.subdomain, config);
    });
  }

  getTenantBySubdomain(subdomain: string): TenantConfig | null {
    return this.tenants.get(subdomain) || null;
  }

  async getDatabaseConnection(subdomain: string) {
    if (this.dbConnections.has(subdomain)) {
      return this.dbConnections.get(subdomain);
    }

    let tenant = this.getTenantBySubdomain(subdomain);
    if (!tenant) {
      tenant = this.getTenantBySubdomain("demo");
    }

    const pool = new Pool({
      connectionString: tenant.databaseUrl,
      max: 10,
      idleTimeoutMillis: 60000,
      connectionTimeoutMillis: 10000,
      acquireTimeoutMillis: 10000,
      ssl: tenant.databaseUrl?.includes("1.55.212.135")
        ? false // Disable SSL for external server
        : tenant.databaseUrl?.includes("neon")
          ? { rejectUnauthorized: false }
          : undefined,
    });

    const db = drizzle({ client: pool, schema });
    this.dbConnections.set(subdomain, db);

    return db;
  }

  getAllTenants(): TenantConfig[] {
    return Array.from(this.tenants.values());
  }

  addTenant(config: TenantConfig) {
    this.tenants.set(config.subdomain, config);
  }

  removeTenant(subdomain: string) {
    this.tenants.delete(subdomain);
    this.dbConnections.delete(subdomain);
  }
}

export const tenantManager = new TenantManager();
