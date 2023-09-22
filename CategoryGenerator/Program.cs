﻿using System;
using Newtonsoft.Json;
using InputCategory = System.Collections.Generic.Dictionary<string, CategoryGenerator.CategoryCast>;
					JObject newCat = new() {
						["name"] = cat.Value.name
					};
					if (cat.Value.page is not null) newCat.Add("page", cat.Value.page);
					if (cat.Value.items is not null) {
						string[] filter = cat.Value.items.Split('<');
						if (filter.Length > 1) {
							string path = filter[0];
							filter = filter[1].Split('|');
							newCat.Add("items", new JArray(stats
								.Where(s => s.data.TryGetValue(path, out JToken value) && value.Any(t => filter.Contains(t.ToString()))
								).Select(s => s.name)
							));
						} else {
							filter = cat.Value.items.Split('=');
							string path = filter[0];
							filter = filter[1].Split('|');

							newCat.Add("items", new JArray(stats
								.Where(s => s.data.TryGetValue(path, out JToken value) && filter.Contains(value.ToString()))
								.Select(s => s.name)
							));
						}
					} else {
						newCat.Add("items", new JArray(stats.Select(s => s.name)));
					}
					categories.Add(cat.Key, newCat);
				}
		public string name;
		public string page;
		public string items;
	}
		public string name;
		public string page;
		public string[] items;
	}