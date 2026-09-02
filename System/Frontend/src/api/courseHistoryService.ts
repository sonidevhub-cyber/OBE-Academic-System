import { api } from "./api";

export const courseHistoryService = {
  getHistory: () => {
    return api.get("course-history/");
  },
};

export default courseHistoryService;