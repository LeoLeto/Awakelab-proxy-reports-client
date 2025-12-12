export type LicenseRow = {
  customer_ref: string | null;
  customer_name: string | null;
  customer_source: Record<string, unknown> | null;
  user_username: string | null;
  user_fullname: string | null;
  product_ref: string | null;
  product_title: string | null;
  product_duration: string | null;
  product_price: string | null;
  license_details: string | null;
  license_start: string | null;
  license_end: string | null;
  tracking_first_access: string | null;
  tracking_last_access: string | null;
  tracking_visits: string | null;
  tracking_elapsed_time: string | null;
};

export type LicenseDetailsResponse = {
  status: string;
  code: string;
  info: {
    record_count: string;
    total_count: string;
    current_page: string;
    total_pages: string;
  };
  message: {
    licenses: {
      license: LicenseRow[];
    };
  };
};
