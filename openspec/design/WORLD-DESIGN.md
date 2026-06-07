# World Design — Maplewood Community

## Geographic Layout

Maplewood is a small US suburban community inspired by neighborhoods in Portland, OR and Chapel Hill, NC. The layout follows a realistic street grid with curved residential roads, green spaces, and a walkable main street.

## Map Grid

The map is 80x60 tiles (2560x1920 px at 32px tiles). Coordinate system: (0,0) top-left.

```
N
^
|
+---+---+---+---+---+---+---+---+---+---+---+---+
|   |   Elm Park        |   |   |   |   |   |   |
|   | (playground, pond, |   |   |   |   |   |   |
|   |  trails, gazebo)   |   |   |   |   |   |   |
+---+---+---+---+---+---+---+---+---+---+---+---+
|   |   Community Dr     |   |   |   |   |   |   |
|   +---+---+---+---+---+---+---+---+---+---+   |
|   | Community | Fire  |   |   Medical  |   |   |
|   | Center    | Stn   |   |   Center   |   |   |
+---+---+---+---+---+---+---+---+---+---+---+---+
|   |   Oak Lane (residential, curved street)     |
|   | [H1] [H2] [H3]  [H4] [H5] [H6]           |
|   |   lawns, trees, driveways                   |
+---+---+---+---+---+---+---+---+---+---+---+---+
|   |   Oak Lane continues        |   Library    |
+---+---+---+---+---+---+---+---+---+---+---+---+
|   |   === Main Street ===                      |
|   | [Cafe] [Grocery] [Bar] [Bookstore] [Pharm]|
|   |   sidewalks, street parking, lampposts     |
+---+---+---+---+---+---+---+---+---+---+---+---+
|   |   Main St continues   |   School           |
|   |   |                    |  (playground)      |
+---+---+---+---+---+---+---+---+---+---+---+---+
|   |   Riverside Tech    |   Town Hall          |
|   |   (office building)  |   (gov building)    |
+---+---+---+---+---+---+---+---+---+---+---+---+
|                   |                            |
|  Maple Court      |    (open area / future     |
|  (apartments)     |     expansion)             |
+---+---+---+---+---+---+---+---+---+---+---+---+
```

## Location Definitions

### Residential — Oak Lane

| # | Location | Type | Occupant(s) | Objects |
|---|----------|------|-------------|---------|
| H1 | 1 Oak Lane | House | Sarah & David Chen | Bed(x2), Kitchen, Bathroom, Couch, Desk, Garage(Car) |
| H2 | 3 Oak Lane | House | Marcus & Elena Williams | Bed(x2), Kitchen, Bathroom, Couch, TV, Garage(Car) |
| H3 | 5 Oak Lane | House | James Henderson | Bed, Kitchen, Bathroom, Recliner, Garage(Truck) |
| H4 | 7 Oak Lane | House | Aisha Patel | Bed, Kitchen, Bathroom, Yoga Mat, Bike(in garage) |
| H5 | 9 Oak Lane | House | Tom & Rosa Moreno | Bed(x2), Kitchen, Bathroom, Couch, Garage(Car) |
| H6 | 11 Oak Lane | House | Bob Fisher | Bed, Kitchen, Bathroom, Fish Tank, Garage(Car) |

### Residential — Maple Court

| # | Location | Type | Occupant(s) | Objects |
|---|----------|------|-------------|---------|
| A1 | Apt 101 | Apartment | Kai Nakamura | Bed, Kitchenette, Desk+PC, Bike(outside) |
| A2 | Apt 102 | Apartment | Zoe Martinez | Bed, Kitchenette, Guitar, Bookshelf |

### Commercial — Main Street

| Location | Type | Owner/Staff | Objects |
|----------|------|-------------|---------|
| Sunrise Cafe | Cafe/Restaurant | Owner: Rosa Moreno (also lives on Oak Lane) | Counter, Espresso Machine, 6 Tables, Display Case, Bulletin Board |
| Greenleaf Grocery | Supermarket | Staff: part-time workers | 4 Aisle rows, Checkout(2), Freezer section |
| Birch & Barrel | Restaurant/Bar | Owner: external | Bar counter, 8 Tables, Kitchen(staff), Stage area |
| Pages Bookstore | Bookshop | Owner: Elena Williams | Bookshelves(5), Reading Nook, Cash Register, Coffee corner |
| Corner Pharmacy | Pharmacy | Staff: pharmacist | Medicine shelves, Counter, Checkout |

### Community

| Location | Type | Staff | Objects |
|----------|------|-------|---------|
| Maplewood Elementary | School | Teachers: Sarah Chen, Mr. Park | Classrooms(3), Playground, Principal Office, Gym |
| Community Center | Community | Staff: admin | Gym(Treadmills, Weights), Meeting Rooms(2), Lobby |
| Elm Park | Park | Public | Playground, Walking Trail, Pond, Gazebo, 8 Benches, Fountain |
| Fire Station | Emergency | Firefighters | Truck bay, Living quarters, Dispatch |

### Workplaces

| Location | Type | Staff | Objects |
|----------|------|-------|---------|
| Town Hall | Government | Mayor, Clerks | Mayor Office, Clerk Office, Meeting Room, Lobby |
| Riverside Tech | Tech Startup | Engineers: Kai, others | Open Office(6 desks), Conference Room, Kitchen, Server Room |
| Maplewood Medical Center | Medical | Doctor, Nurse | Reception, Exam Rooms(2), Pharmacy, Waiting Area |
| Community Library | Library | Librarian | Reading Area, Computer Lab(4 PCs), Children Section, Checkout |

## Street Network

```
Streets are traversable paths for walking, driving, cycling.

Oak Lane -----> Community Drive -----> Main Street
    |                                      |
    v                                      v
Library <--- Oak Lane Ext ---> School <--- Main St Ext
                                        |
                                        v
                              Riverside Tech / Town Hall
                                        |
                                        v
                                   Maple Court
```

Travel times (walking, approximate):
- Oak Lane to Main Street: 8 min
- Main Street to School: 5 min
- Anywhere to Elm Park: 5-10 min
- Oak Lane to Riverside Tech: 12 min
- Full community walk: ~30 min

## Weather System [Extended]

Simple weather affecting agent behavior:
- Sunny (default): normal behavior
- Rainy: prefer indoor activities, carry umbrella, driving preferred over walking
- Cold (<40F): wear layers, shorter outdoor time, heater usage
- Hot (>90F): seek shade/AC, more water consumption
- Snow (rare): stay home if possible, school closure

## Day/Night Cycle [Extended]

| Time | Lighting | Activity Level |
|------|----------|---------------|
| 5:00-6:00 AM | Pre-dawn | Very low (night owls still up) |
| 6:00-7:00 AM | Dawn | Rising (early birds) |
| 7:00-9:00 AM | Morning | Peak commute, breakfast |
| 9:00 AM-5:00 PM | Daytime | Work/school hours |
| 5:00-7:00 PM | Evening golden hour | Commute home, shopping, park |
| 7:00-10:00 PM | Twilight to dark | Dinner, socializing, relaxation |
| 10:00 PM-5:00 AM | Night | Sleeping (most agents), night shift workers |
