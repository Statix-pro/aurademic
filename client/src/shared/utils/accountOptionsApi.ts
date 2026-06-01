import authenticityUtility from "./authenticityUtility";

export interface AccountOption {
  id: number;
  name: string;
}

const normalizeAccountOptions = (rows: unknown): AccountOption[] => {
  if (!Array.isArray(rows)) return [];

  return rows
    .map((row: any) => ({
      id: Number(row?.id || 0),
      name: String(row?.name ?? row?.account_name ?? "").trim(),
    }))
    .filter((row) => row.id > 0 && row.name);
};

export const fetchAccountOptions = async (): Promise<AccountOption[]> => {
  const response = await authenticityUtility.get("/account-options") as {
    success?: boolean;
    data?: unknown;
    message?: string;
    error?: string;
  };

  if (response.success === true) {
    return normalizeAccountOptions(response.data);
  }

  throw new Error(response.message || response.error || "Failed to load account options");
};

export const createAccountOption = async (name: string): Promise<AccountOption> => {
  const response = await authenticityUtility.post("/account-options", {
    name: String(name || "").trim(),
  }) as {
    success?: boolean;
    data?: unknown;
    message?: string;
  };

  const options = normalizeAccountOptions(response.data ? [response.data] : []);
  if (response.success === true && options[0]) {
    return options[0];
  }

  throw new Error(response.message || "Failed to add account option");
};

export const updateAccountOption = async (id: number, name: string): Promise<AccountOption> => {
  const response = await authenticityUtility.patch(`/account-options/${id}`, {
    name: String(name || "").trim(),
  }) as {
    success?: boolean;
    data?: unknown;
    message?: string;
  };

  const options = normalizeAccountOptions(response.data ? [response.data] : []);
  if (response.success === true && options[0]) {
    return options[0];
  }

  throw new Error(response.message || "Failed to update account option");
};

export const deleteAccountOption = async (id: number): Promise<void> => {
  const response = await authenticityUtility.delete(`/account-options/${id}`) as {
    success?: boolean;
    message?: string;
  };

  if (response.success !== true) {
    throw new Error(response.message || "Failed to delete account option");
  }
};
