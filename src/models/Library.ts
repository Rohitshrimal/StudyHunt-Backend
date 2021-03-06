import * as moment from "moment";
import db from "../db";
import Seat from "./Seat";
import Model from "./Model";

class Library extends Model {
  protected static tableName = 'libraries';

  static async getSeats(libraryId: number) {
    return await db.select(
      'id',
      'is_vacant',
      'pos_x',
      'pos_y',
      'created_at',
      'updated_at'
    ).from('seats').where('library_id', libraryId);
  }

  static async countAllSeats(libraryId: number): Promise<number> {
    let res = await db('seats').where('library_id', libraryId).count('*');

    return res[0]["count(*)"];
  }

  static async countVacantSeats(libraryId: number): Promise<number> {
    let res = await db('seats').where({
      'library_id': libraryId,
      'is_vacant': true
    }).count('*');

    return res[0]["count(*)"];
  }

  static async getGridDimensions(libraryId: number) {
    let res = await db('seats').select('pos_x').where({
      'library_id': libraryId
    }).orderBy('pos_x', 'DESC').limit(1);

    // No seats found in DB, return null
    if (res.length === 0) {
      return [null, null];
    }

    let width = res[0].pos_x + 1;

    res = await db('seats').select('pos_y').where({
      'library_id': libraryId
    }).orderBy('pos_y', 'DESC').limit(1);

    let height = res[0].pos_y + 1;

    return [width, height];
  }

  static async search(query: string): Promise<any> {
    return await db(this.tableName).where(
      db.raw(`LOWER(name) LIKE '%${query.toLowerCase()}%'`)
    );
  }

  /**
   * Fetches global statistics
   */
  static async global(): Promise<any> {
    let capacity = await db('seats').count('* as c');
    let vacantSeats = await db('seats').count('* as c').where('is_vacant', true);

    return {
      energyEfficiency: 56, // TODO Dynamically calculate energy efficiency
      capacity: capacity[0].c,
      vacantSeats: vacantSeats[0].c
    }
  }

  /**
   * Counts the number of occupied seats
   * @param libraryId
   * @param time Format: YYYY-MM-DD HH:mm:ss
   */
  static async getOccupiedSeats(libraryId: number, time: moment.Moment) {
    let res = await db('seats').count().leftJoin(
      db.select().from('seats_log').whereIn('id',
        db.max('id').from('seats_log')
          .where('seats_log.created_at', '<', time.format("YYYY-MM-DD HH:mm:ss"))
          .groupBy('seat_id')
      ).as('most_recent_seat'),
      'seats.id',
      '=',
      'most_recent_seat.seat_id'
    ).where({
      'seats.library_id': libraryId,
      'most_recent_seat.is_vacant': false
    });

    return res[0]['count(*)'];
  }

  static async getHistory(libraryId: number): Promise<any> {
    let capacity = await this.countAllSeats(libraryId);

    let history = [];

    for (let i = 0; i < 24; i++) {
      let time: moment.Moment = moment().subtract(i, 'hours');
      let occupiedSeats = await this.getOccupiedSeats(libraryId, time);
      let vacancies = capacity - occupiedSeats;
      history.unshift({
        time: time.toISOString(),
        vacantSeats: vacancies
      });
    }

    return history;
  }
}

export default Library;
