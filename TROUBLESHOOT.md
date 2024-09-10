Hang at :
```
{"id":"e0b4c4441706db3cc67d30c6f6cd4ab50d709c1c21940419a30032e2045740bc","slot":39032458,"height":6192761}
```
After ~1h30m

---

Started from Origin
```
{"id":"59c678acbb288954b71b62aae8e6cb92a5a9a4b96e20fa02f3176acf256bb8b1","slot":1434576,"height":1434332}
```

---

Started from origin
```
{"id":"92c8e9ade3f8b642014403a9ebd5a54ff24db22d9d759645413cedeaa3b9b982","slot":123207694,"height":10268346}
```
Hang after few hours.

---

My dummy check catched and rebooted the indexer

```
indexer-1  | 9/9/2024, 9:11:30 PM ERROR:   The Indexer is probably stuck for an unknown reason. (See troubleshooting)
indexer-1  | 9/9/2024, 9:12:00 PM ERROR:   The indexer might be stuck (or rollbacked) at 134350021 134350021
```

---

```
tgingras@fedora:~/cardano-indexer-main$ docker compose logs indexer --tail 10000 | grep stuck
indexer-1  | 9/10/2024, 2:11:34 AM ERROR:   The indexer might be stuck (or rollbacked) at 134367999 134367999
indexer-1  | 9/10/2024, 2:13:01 AM ERROR:   The Indexer is probably stuck for an unknown reason. (See troubleshooting)
indexer-1  | 9/10/2024, 2:14:01 AM ERROR:   The Indexer is probably stuck for an unknown reason. (See troubleshooting)
```

Once the tip is synced the issue occured frequently, will increase to 2 minutes to avoid it.
